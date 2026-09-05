"""
Ingestion HTTP Gateway Routes (Revision 2.2).
HTTP transport only — max 50 lines per handler, no business logic, no try-except.
"""

from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, Query, UploadFile, status

from app.api.core.custom_exceptions.exceptions import IngestionError
from app.api.core.dependencies import AuthenticatedUser, DbSession, WriteUser
from app.api.modules.v1.ingestion.models.ingestion_job import IngestionJob
from app.api.modules.v1.ingestion.schemas.ingestion_schemas import (
    IngestionJobResponse,
    IngestionUploadResponse,
)
from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/ingest", tags=["Ingestion"])

MAX_INGEST_FILE_SIZE = 25 * 1024 * 1024  # 25 MB limit to protect from OOM/DoS
JOB_TIMEOUT_MINUTES = 10


@router.post("/upload", response_model=None, status_code=status.HTTP_202_ACCEPTED)
async def upload_workbook(
    file: Annotated[UploadFile, File(...)],
    current_user: WriteUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
    duplicate_strategy: str = Query(default="skip", pattern="^(skip|update|fail)$"),
):
    """
    Accepts an Excel workbook for asynchronous ingestion.
    Requires admin, compliance, or reviewer role (D2).
    Dispatches processing to background task and returns HTTP 202 Accepted.
    """
    content = await file.read(MAX_INGEST_FILE_SIZE + 1)
    if len(content) > MAX_INGEST_FILE_SIZE:
        raise IngestionError(
            f"Uploaded file '{file.filename}' exceeds maximum permitted limit of 25 MB."
        )

    # Fast synchronous preflight verification before accepting job
    IngestionService.validate_workbook_preflight(content, file.filename)

    job_id = f"INGEST-{uuid4().hex[:12]}"
    job = IngestionJob(
        job_id=job_id,
        status="PENDING",
        filename=file.filename,
        file_size_bytes=len(content),
        uploaded_by=current_user.user_id,
        duplicate_strategy=duplicate_strategy,
    )
    db.add(job)
    await db.commit()

    # Enqueue background task with isolated session factory (D4)
    background_tasks.add_task(
        IngestionService.run_ingestion_job,
        job_id=job_id,
        file_bytes=content,
        duplicate_strategy=duplicate_strategy,
    )

    data = IngestionUploadResponse(
        job_id=job_id,
        status="PENDING",
        filename=file.filename,
        duplicate_strategy=duplicate_strategy,
        check_status_url=f"/api/v1/ingest/jobs/{job_id}",
    )
    return success_response(
        status_code=status.HTTP_202_ACCEPTED,
        message="Workbook accepted for asynchronous ingestion",
        data=data.model_dump(),
    )


@router.get("/jobs", response_model=None)
async def list_ingestion_jobs(
    current_user: AuthenticatedUser,
    db: DbSession,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """
    List historical ingestion jobs with pagination.
    Privileged roles (admin, compliance) view all jobs; others see their own.
    """
    jobs = await IngestionService.list_jobs_for_user(
        session=db,
        user=current_user,
        limit=limit,
        offset=offset,
    )

    items = [
        IngestionJobResponse(
            job_id=j.job_id,
            status=j.status,  # type: ignore[arg-type]
            filename=j.filename,
            file_size_bytes=j.file_size_bytes,
            uploaded_by=j.uploaded_by,
            duplicate_strategy=j.duplicate_strategy,
            total_rows=j.total_rows,
            processed_rows=j.processed_rows,
            inserted_rows=j.inserted_rows,
            updated_rows=j.updated_rows,
            skipped_rows=j.skipped_rows,
            error_rows=j.error_rows,
            summary_report=j.summary_report,
            error_log=j.error_log[:5],
            started_at=j.started_at,
            completed_at=j.completed_at,
            created_at=j.created_at,
        ).model_dump()
        for j in jobs
    ]
    return success_response(
        status_code=status.HTTP_200_OK,
        message=f"Retrieved {len(items)} ingestion jobs",
        data={"jobs": items, "limit": limit, "offset": offset},
    )


@router.get("/jobs/{job_id}", response_model=None)
async def get_ingestion_job(
    job_id: str,
    current_user: AuthenticatedUser,
    db: DbSession,
):
    """
    Telemetry and audit query endpoint for an ingestion job.
    Enforces ownership or admin/compliance role (D1).
    """
    job = await IngestionService.get_job_for_user(
        session=db,
        user=current_user,
        job_id=job_id,
        timeout_minutes=JOB_TIMEOUT_MINUTES,
    )

    dto = IngestionJobResponse(
        job_id=job.job_id,
        status=job.status,  # type: ignore[arg-type]
        filename=job.filename,
        file_size_bytes=job.file_size_bytes,
        uploaded_by=job.uploaded_by,
        duplicate_strategy=job.duplicate_strategy,
        total_rows=job.total_rows,
        processed_rows=job.processed_rows,
        inserted_rows=job.inserted_rows,
        updated_rows=job.updated_rows,
        skipped_rows=job.skipped_rows,
        error_rows=job.error_rows,
        summary_report=job.summary_report,
        error_log=job.error_log,
        started_at=job.started_at,
        completed_at=job.completed_at,
        created_at=job.created_at,
    )
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Ingestion job telemetry retrieved",
        data=dto.model_dump(),
    )
