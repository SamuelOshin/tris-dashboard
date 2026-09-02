"""
Ingestion HTTP Gateway Routes.
HTTP transport only — max 50 lines per handler, no business logic, no try-except.
"""

from io import BytesIO
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.db.database import get_db
from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/ingest", tags=["Ingestion"])


@router.post("/upload", response_model=None)
async def upload_workbook(
    file: Annotated[UploadFile, File(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Upload and ingest an Excel workbook into the TRIS relational database."""
    content = await file.read()
    report = await IngestionService.ingest_excel_workbook(
        file_path_or_bytes=BytesIO(content),
        session=db,
        filename=file.filename,
    )
    return success_response(
        status_code=status.HTTP_201_CREATED,
        message="Workbook ingested successfully",
        data=report,
    )
