"""
Material risk scoring HTTP gateway. HTTP transport only: parse input, call the service, respond.

Reading scores is open to every role that can see Manufacturing; running scoring (which stores
scores) needs an analytics-execution role; changing the weights needs a configuration role.
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.core.dependencies import (
    AnalyticsExecutionUser,
    DbSession,
    ManufacturingConfigUser,
    ManufacturingViewUser,
)
from app.api.modules.v1.manufacturing.schemas.risk_schemas import WeightSetRequest
from app.api.modules.v1.manufacturing.service import risk_scoring_service as scoring
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/manufacturing/risk-scoring", tags=["Manufacturing Risk Scoring"])

AsOf = Annotated[date | None, Query(description="Use data up to this date")]
Dataset = Annotated[str | None, Query(max_length=100)]


@router.get("/weights", response_model=None)
async def weight_sets(_user: ManufacturingViewUser, db: DbSession):
    """Every weight set version, newest first; the newest is the active one."""
    return success_response(
        status.HTTP_200_OK, "Risk weight sets", await scoring.list_weight_sets(db)
    )


@router.post("/weights", response_model=None)
async def new_weight_set(body: WeightSetRequest, user: ManufacturingConfigUser, db: DbSession):
    """Store a new weight set version. Earlier versions and stored scores are never changed."""
    data = await scoring.create_weight_set(db, user, body.config_dict(), body.note)
    return success_response(status.HTTP_201_CREATED, "Risk weights saved", data)


@router.post("/run", response_model=None)
async def run_scoring(
    user: AnalyticsExecutionUser,
    db: DbSession,
    as_of: AsOf = None,
    dataset_id: Dataset = None,
    material_id: Annotated[str | None, Query(max_length=50)] = None,
):
    """Score materials as of a date and store each score produced as a new record."""
    data = await scoring.run_scoring(db, user, as_of, dataset_id, material_id)
    return success_response(status.HTTP_201_CREATED, "Risk scores stored", data)


@router.get("/scores", response_model=None)
async def latest_scores(
    _user: ManufacturingViewUser, db: DbSession, as_of: AsOf = None, dataset_id: Dataset = None
):
    """The newest stored score per material for the date."""
    data = await scoring.latest_scores(db, as_of, dataset_id)
    return success_response(status.HTTP_200_OK, "Material risk scores", data)


@router.get("/materials/{material_id}", response_model=None)
async def material_scores(
    material_id: str,
    _user: ManufacturingViewUser,
    db: DbSession,
    as_of: AsOf = None,
    dataset_id: Dataset = None,
):
    """The latest stored score for a material with every factor, plus its score history."""
    data = await scoring.material_scores(db, material_id, as_of, dataset_id)
    return success_response(status.HTTP_200_OK, "Material risk score", data)


@router.get("/scores/{score_id}", response_model=None)
async def score_detail(score_id: str, _user: ManufacturingViewUser, db: DbSession):
    """One stored score exactly as it was made."""
    return success_response(status.HTTP_200_OK, "Risk score", await scoring.get_score(db, score_id))
