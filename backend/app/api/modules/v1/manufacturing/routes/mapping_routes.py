"""
ERP/BOM mapping HTTP gateway. HTTP transport only: parse input, call the service, respond.

Uploading, previewing, validating and importing need an ingestion role (admin or reviewer).
Saving or deleting a mapping profile is configuration and needs an admin.
"""

from typing import Annotated, Any

from fastapi import APIRouter, File, Form, Query, UploadFile, status
from fastapi.responses import Response

from app.api.core.dependencies import DbSession, ManufacturingConfigUser, ManufacturingIngestionUser
from app.api.modules.v1.manufacturing.models import MappingProfile
from app.api.modules.v1.manufacturing.schemas.mapping_schemas import (
    MappingProfileCreate,
    MappingProfileResponse,
)
from app.api.modules.v1.manufacturing.service import mapping_profile_service as profiles
from app.api.modules.v1.manufacturing.service import mapping_service as mapping
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/manufacturing/mapping", tags=["Manufacturing Mapping"])

UploadFileField = Annotated[UploadFile, File(...)]
ConfigField = Annotated[str, Form(...)]


async def _read(file: UploadFile) -> bytes:
    return await file.read(mapping.MAX_UPLOAD_BYTES + 1)


def _profile_dto(profile: MappingProfile) -> dict[str, Any]:
    return MappingProfileResponse.model_validate(profile, from_attributes=True).model_dump()


@router.get("/targets", response_model=None)
async def get_targets(_user: ManufacturingIngestionUser):
    """Canonical tables and fields a file can be mapped to, with required/optional flags."""
    return success_response(status.HTTP_200_OK, "Mapping targets", mapping.describe_targets())


@router.post("/preview", response_model=None)
async def preview_upload(
    file: UploadFileField,
    _user: ManufacturingIngestionUser,
    target: Annotated[str, Form(...)],
    sheet: Annotated[str | None, Form()] = None,
):
    """Read an uploaded CSV/XLSX and return its columns, sample rows and suggested mappings."""
    data = mapping.preview_file(await _read(file), file.filename, target, sheet)
    return success_response(status.HTTP_200_OK, "File preview ready", data)


@router.post("/validate", response_model=None)
async def validate_upload(
    file: UploadFileField, config: ConfigField, _user: ManufacturingIngestionUser, db: DbSession
):
    """Dry run: check every row against the mapping without saving anything."""
    cfg = mapping.parse_run_config(config)
    data = await mapping.validate_file(db, await _read(file), file.filename, cfg)
    return success_response(status.HTTP_200_OK, "Validation complete", data)


@router.post("/import", response_model=None)
async def import_upload(
    file: UploadFileField, config: ConfigField, user: ManufacturingIngestionUser, db: DbSession
):
    """Validate and import the file, returning the ingestion summary and error log."""
    cfg = mapping.parse_run_config(config)
    data = await mapping.import_file(db, user, await _read(file), file.filename, cfg)
    return success_response(status.HTTP_200_OK, "Import finished", data)


@router.get("/jobs/{job_id}/errors.csv", response_model=None)
async def download_error_log(job_id: str, user: ManufacturingIngestionUser, db: DbSession):
    """Download the rejected-row log of an import as CSV."""
    body = await mapping.error_log_csv(db, user, job_id)
    headers = {"Content-Disposition": f'attachment; filename="{job_id}-errors.csv"'}
    return Response(content=body, media_type="text/csv", headers=headers)


@router.get("/profiles", response_model=None)
async def list_profiles(
    _user: ManufacturingIngestionUser, db: DbSession, target: Annotated[str | None, Query()] = None
):
    """Saved mapping profiles, optionally for one target table."""
    items = [_profile_dto(p) for p in await profiles.list_profiles(db, target)]
    return success_response(status.HTTP_200_OK, "Mapping profiles", {"profiles": items})


@router.post("/profiles", response_model=None)
async def save_profile(payload: MappingProfileCreate, user: ManufacturingConfigUser, db: DbSession):
    """Save a mapping profile for reuse (admin)."""
    profile = await profiles.create_profile(db, user, payload)
    return success_response(status.HTTP_201_CREATED, "Mapping profile saved", _profile_dto(profile))


@router.get("/profiles/{profile_id}", response_model=None)
async def get_profile(profile_id: str, _user: ManufacturingIngestionUser, db: DbSession):
    """Reload one saved mapping profile."""
    profile = await profiles.get_profile(db, profile_id)
    return success_response(status.HTTP_200_OK, "Mapping profile", _profile_dto(profile))


@router.delete("/profiles/{profile_id}", response_model=None)
async def delete_profile(profile_id: str, _user: ManufacturingConfigUser, db: DbSession):
    """Delete a saved mapping profile (admin)."""
    await profiles.delete_profile(db, profile_id)
    return success_response(status.HTTP_200_OK, "Mapping profile deleted", {})
