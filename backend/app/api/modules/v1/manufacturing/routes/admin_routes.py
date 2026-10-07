"""
Administration HTTP gateway (administrators only). HTTP transport only: parse input, call the
service, respond. Weights and mapping profiles keep their existing endpoints.
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.core.dependencies import DbSession, ManufacturingConfigUser
from app.api.modules.v1.manufacturing.schemas.admin_schemas import (
    DatasetLabelRequest,
    ModelSettingRequest,
)
from app.api.modules.v1.manufacturing.service import admin_service as admin
from app.api.modules.v1.manufacturing.service import dataset_registry_service as datasets
from app.api.modules.v1.manufacturing.service import model_settings_service as model_settings
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/manufacturing/admin", tags=["Manufacturing Administration"])


@router.get("/configuration", response_model=None)
async def get_configuration(_user: ManufacturingConfigUser, db: DbSession):
    """Forecast models, forecast and validation settings and the active risk weights."""
    return success_response(status.HTTP_200_OK, "Configuration", await admin.configuration(db))


@router.put("/models/{code}", response_model=None)
async def set_model(
    code: str, body: ModelSettingRequest, user: ManufacturingConfigUser, db: DbSession
):
    """Switch a forecast model on or off. Earlier forecasts and the change history are kept."""
    data = await model_settings.set_model_enabled(db, user, code, body.enabled, body.note)
    return success_response(status.HTTP_200_OK, "Model setting saved", {"models": data})


@router.get("/datasets", response_model=None)
async def list_datasets(_user: ManufacturingConfigUser, db: DbSession):
    """The dataset registry with record counts and date ranges."""
    data = await datasets.list_datasets(db)
    return success_response(status.HTTP_200_OK, "Datasets", {"datasets": data})


@router.put("/datasets/{dataset_id}/label", response_model=None)
async def set_dataset_label(
    dataset_id: str, body: DatasetLabelRequest, user: ManufacturingConfigUser, db: DbSession
):
    """State whether a dataset is synthetic or authorised data."""
    data = await datasets.set_label(db, user, dataset_id, body.label)
    return success_response(status.HTTP_200_OK, "Dataset label saved", {"datasets": data})


@router.get("/audit-events", response_model=None)
async def audit_events(
    _user: ManufacturingConfigUser,
    db: DbSession,
    event_type: Annotated[str | None, Query(max_length=50)] = None,
    actor: Annotated[str | None, Query(max_length=100)] = None,
    since: date | None = None,
    until: date | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """The audit trail of imports, runs, configuration changes and sign-ins, newest first."""
    data = await admin.audit_events(db, event_type, actor, since, until, limit, offset)
    return success_response(status.HTTP_200_OK, "Audit events", data)
