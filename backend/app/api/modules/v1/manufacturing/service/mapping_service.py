"""
ERP/BOM mapping service: preview, dry-run validation, import with job tracking, and the
downloadable error log. Pure business logic — raises domain exceptions directly.

Import telemetry is stored in the existing `IngestionJob` table (D1: extend, do not duplicate).
Mapping jobs are told apart by `summary_report["import_type"] == "manufacturing_mapping"`.
"""

import csv
import io
import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.custom_exceptions.exceptions import IngestionError, NotFoundError, ValidationError
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.ingestion.models.ingestion_job import IngestionJob
from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService
from app.api.modules.v1.manufacturing.models import MappingProfile
from app.api.modules.v1.manufacturing.schemas.mapping_schemas import MappingRunConfig
from app.api.modules.v1.manufacturing.service import admin_audit as audit
from app.api.modules.v1.manufacturing.service import dataset_registry_service as datasets
from app.api.modules.v1.manufacturing.service.file_parser import (
    ParsedTable,
    parse_source_file,
    sample_rows,
)
from app.api.modules.v1.manufacturing.service.mapping_definition import build_settings, get_target
from app.api.modules.v1.manufacturing.service.mapping_engine import (
    ERROR_LOG_CAP,
    MappingSettings,
    RunResult,
    run_mapping,
)
from app.api.modules.v1.manufacturing.service.mapping_targets import TARGETS, TargetSpec
from app.api.modules.v1.manufacturing.service.source_profiles import (
    PROFILE_LABELS,
    best_profile,
    suggest_all_profiles,
)

logger = logging.getLogger("tris.manufacturing.mapping")

IMPORT_TYPE = "manufacturing_mapping"
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def describe_targets() -> dict[str, Any]:
    """Canonical tables and fields (required vs optional) plus the source-profile presets."""

    def describe_field(target: TargetSpec, name: str) -> dict[str, Any]:
        spec = target.field(name)
        return {
            "name": spec.name,
            "kind": spec.kind,
            "required": spec.required,
            "description": spec.description,
            "default": spec.default,
            "references": spec.ref,
        }

    return {
        "targets": [
            {
                "key": t.key,
                "label": t.label,
                "description": t.description,
                "fields": [describe_field(t, f.name) for f in t.fields],
                "any_of": [list(group) for group in t.any_of],
            }
            for t in TARGETS
        ],
        "source_profiles": [{"key": k, "label": v} for k, v in PROFILE_LABELS.items()],
    }


def check_upload_size(content: bytes, filename: str | None) -> None:
    """Reject files over the upload limit (same 25 MB cap as the v1.4 workbook upload)."""
    if len(content) > MAX_UPLOAD_BYTES:
        raise IngestionError(f"Uploaded file '{filename}' exceeds the 25 MB limit.")


def preview_file(
    content: bytes, filename: str | None, target_key: str, sheet: str | None
) -> dict[str, Any]:
    """Columns, sample rows and a suggested mapping for each source profile."""
    check_upload_size(content, filename)
    target = get_target(target_key)
    table = parse_source_file(content, filename, sheet)
    suggestions = suggest_all_profiles(target.key, table.columns)
    return {
        "filename": filename,
        "columns": table.columns,
        "sample_rows": sample_rows(table),
        "total_rows": table.data_row_count,
        "blank_rows": table.blank_rows,
        "malformed_rows": len(table.structural_errors),
        "sheets": table.sheets,
        "selected_sheet": table.sheet_name if table.sheets else None,
        "target": target.key,
        "suggestions": suggestions,
        "suggested_profile": best_profile(target.key, suggestions),
    }


def parse_run_config(raw: str) -> MappingRunConfig:
    """Parse the JSON mapping configuration sent alongside an upload."""
    try:
        return MappingRunConfig.model_validate_json(raw)
    except PydanticValidationError as exc:
        problems = [
            f"{'.'.join(str(p) for p in e['loc']) or 'settings'}: {e['msg']}" for e in exc.errors()
        ]
        raise ValidationError(
            f"The mapping settings are not valid ({'; '.join(problems)})."
        ) from exc


def _prepare(
    content: bytes, filename: str | None, config: MappingRunConfig
) -> tuple[ParsedTable, MappingSettings]:
    check_upload_size(content, filename)
    table = parse_source_file(content, filename, config.sheet)
    settings = build_settings(
        config.target,
        config.field_mapping,
        config.defaults,
        config.dataset_id,
        config.duplicate_strategy,
        columns=table.columns,
    )
    return table, settings


def _summary(
    result: RunResult, settings: MappingSettings, config: MappingRunConfig, table: ParsedTable
) -> dict[str, Any]:
    return {
        "import_type": IMPORT_TYPE,
        "target": settings.target.key,
        "target_label": settings.target.label,
        "source_profile": config.source_profile,
        "source_profile_label": PROFILE_LABELS[config.source_profile],
        "profile_id": config.profile_id,
        "field_mapping": settings.field_mapping,
        "defaults": settings.defaults,
        "dataset_id": settings.dataset_id,
        "duplicate_strategy": settings.duplicate_strategy,
        "sheet": table.sheet_name,
        "dry_run": result.dry_run,
        "rows_total": result.rows_total,
        "rows_accepted": result.rows_accepted,
        "rows_rejected": result.rows_rejected,
        "rows_duplicate": result.rows_duplicate,
        "rows_blank": result.rows_blank,
        "warnings": result.warnings,
        "missing_values": result.missing_values,
        "unmapped_optional_fields": result.unmapped_optional_fields,
        "field_error_counts": result.field_error_counts,
        "errors_total": result.errors_total,
        "error_log_truncated": result.errors_total > ERROR_LOG_CAP,
        "circuit_breaker": result.circuit_breaker,
    }


async def validate_file(
    session: AsyncSession, content: bytes, filename: str | None, config: MappingRunConfig
) -> dict[str, Any]:
    """Dry run: report what an import would do without writing anything."""
    table, settings = _prepare(content, filename, config)
    result = await run_mapping(session, table, settings, dry_run=True)
    return {
        "job_id": None,
        "status": "FAILED" if result.breaker_tripped else "VALIDATED",
        "summary": _summary(result, settings, config, table),
        "error_log": result.error_log,
    }


def _final_status(result: RunResult) -> str:
    if result.breaker_tripped:
        return "FAILED"
    return "COMPLETED_WITH_ERRORS" if result.rows_rejected else "COMPLETED"


def _apply_result(
    job: IngestionJob, result: RunResult, summary: dict[str, Any], status: str
) -> None:
    job.status = status
    job.summary_report = summary
    job.error_log = list(result.error_log)
    if result.circuit_breaker:
        job.error_log.append(
            {
                "sheet": summary["target_label"],
                "row": -1,
                "field": "circuit_breaker",
                "error": result.circuit_breaker["message"],
                "raw_value": {},
            }
        )
    job.total_rows = result.rows_total + result.rows_blank
    job.processed_rows = result.rows_total
    job.inserted_rows = result.rows_accepted
    job.skipped_rows = result.rows_duplicate + result.rows_blank
    job.error_rows = result.rows_rejected
    job.completed_at = datetime.now(UTC)


async def import_file(
    session: AsyncSession,
    user: User,
    content: bytes,
    filename: str | None,
    config: MappingRunConfig,
) -> dict[str, Any]:
    """
    Validate and import a file, recording an ingestion job.

    Rows that fail validation are rejected individually and logged. If more than 20% of rows
    are bad the whole import is rolled back and the job is recorded as FAILED, so a badly
    mapped column cannot half-load a table.
    """
    table, settings = _prepare(content, filename, config)
    if config.profile_id and await session.get(MappingProfile, config.profile_id) is None:
        raise NotFoundError(f"Mapping profile '{config.profile_id}' was not found.")

    job_id = f"MAP-{uuid4().hex[:12]}"
    job = IngestionJob(
        job_id=job_id,
        status="PROCESSING",
        filename=filename,
        file_size_bytes=len(content),
        uploaded_by=user.user_id,
        duplicate_strategy=config.duplicate_strategy,
        started_at=datetime.now(UTC),
        summary_report={"import_type": IMPORT_TYPE, "target": settings.target.key},
    )
    session.add(job)
    await session.commit()

    try:
        result = await run_mapping(session, table, settings, dry_run=False)
    except Exception as exc:
        logger.exception("Mapping import %s failed unexpectedly", job_id)
        await session.rollback()
        failed = await session.get(IngestionJob, job_id)
        failed.status = "FAILED"
        failed.completed_at = datetime.now(UTC)
        failed.error_log = [
            {
                "sheet": settings.target.label,
                "row": -1,
                "field": "unexpected_error",
                "error": "The import stopped unexpectedly and nothing was saved",
                "raw_value": {},
            }
        ]
        await session.commit()
        raise IngestionError("The import stopped unexpectedly. Nothing was saved.") from exc

    if result.breaker_tripped:
        await session.rollback()  # discards any rows flushed before the insertion-stage trip
    job = await session.get(IngestionJob, job_id)
    summary = _summary(result, settings, config, table)
    _apply_result(job, result, summary, _final_status(result))
    status = job.status
    await datasets.register(session, user, settings.dataset_id)
    audit.record(
        session,
        user,
        audit.DATA_IMPORT,
        "ingestion_job",
        job_id,
        f"{settings.target.label} imported from {filename or 'a file'}: {status.lower()}, "
        f"{result.rows_accepted} rows added, {result.rows_rejected} rejected"
        + (f", dataset '{settings.dataset_id}'" if settings.dataset_id else "")
        + ".",
    )
    await session.commit()
    return {
        "job_id": job_id,
        "status": status,
        "summary": summary,
        "error_log": result.error_log,
    }


def _safe_cell(value: Any) -> str:
    text = value if isinstance(value, str) else json.dumps(value, default=str)
    return f"'{text}" if text.startswith(CSV_FORMULA_PREFIXES) else text


async def error_log_csv(session: AsyncSession, user: User, job_id: str) -> str:
    """Render a mapping job's error log as CSV (cells that could run as formulas are escaped)."""
    job = await IngestionService.get_job_for_user(session, user, job_id)
    if (job.summary_report or {}).get("import_type") != IMPORT_TYPE:
        raise NotFoundError(f"Mapping import '{job_id}' was not found.")
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["row", "sheet", "field", "error", "source_values"])
    for entry in job.error_log:
        writer.writerow(
            [
                entry.get("row"),
                _safe_cell(entry.get("sheet", "")),
                _safe_cell(entry.get("field", "")),
                _safe_cell(entry.get("error", "")),
                _safe_cell(entry.get("raw_value", {})),
            ]
        )
    return buffer.getvalue()
