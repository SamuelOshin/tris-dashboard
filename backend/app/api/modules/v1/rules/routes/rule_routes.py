"""
Rule Engine HTTP Gateway Routes.
HTTP transport only — max 50 lines per handler, no business logic, no try-except.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.dependencies import get_current_user, require_roles
from app.api.db.database import get_db
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.rules.schemas.rule_schemas import (
    EvaluationResult,
    RuleConfigResponse,
    RuleConfigUpdate,
)
from app.api.modules.v1.rules.service.rule_engine_service import RuleEngineService
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/rules", tags=["Rules"])


@router.get("", response_model=None)
async def list_rules(db: Annotated[AsyncSession, Depends(get_db)] = None):
    """Retrieve all detection rule configurations."""
    rules = await RuleEngineService.get_all_rules(session=db)
    data = [RuleConfigResponse.model_validate(r).model_dump() for r in rules]
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Detection rules retrieved successfully",
        data=data,
    )


@router.get("/{rule_code}", response_model=None)
async def get_rule(rule_code: str, db: Annotated[AsyncSession, Depends(get_db)] = None):
    """Retrieve configuration for a specific rule code."""
    rule = await RuleEngineService.get_rule_by_code(rule_code=rule_code, session=db)
    data = RuleConfigResponse.model_validate(rule).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Rule configuration retrieved successfully",
        data=data,
    )


@router.patch("/{rule_code}", response_model=None)
async def update_rule(
    rule_code: str,
    payload: RuleConfigUpdate,
    current_user: Annotated[User, Depends(require_roles(["admin", "compliance"]))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """
    Update rule thresholds or weights (increments rule_version).
    Requires admin or compliance role.
    """
    updated = await RuleEngineService.update_rule(
        rule_code=rule_code,
        update_data=payload,
        session=db,
    )
    data = RuleConfigResponse.model_validate(updated).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message=f"Rule {rule_code} updated to version {updated.rule_version}",
        data=data,
    )


@router.post("/evaluate/{transaction_id}", response_model=None)
async def evaluate_transaction(
    transaction_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Execute active detection rules against a transaction and consolidate signals."""
    result = await RuleEngineService.evaluate_transaction(
        transaction_id=transaction_id,
        session=db,
        auto_create_case=True,
    )
    data = EvaluationResult.model_validate(result).model_dump()
    msg = f"Transaction evaluated with composite score {result.total_score} ({result.priority})"
    return success_response(
        status_code=status.HTTP_200_OK,
        message=msg,
        data=data,
    )
