"""
Rule Engine HTTP Gateway Routes.
HTTP transport only — max 50 lines per handler, no business logic, no try-except.
"""

from fastapi import APIRouter, status

from app.api.core.dependencies import AuthenticatedUser, DbSession, PrivilegedUser
from app.api.modules.v1.rules.schemas.rule_schemas import (
    EvaluationResult,
    RuleConfigResponse,
    RuleConfigUpdate,
)
from app.api.modules.v1.rules.service.rule_engine_service import RuleEngineService
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/rules", tags=["Rules"])


@router.get("", response_model=None)
async def list_rules(
    current_user: AuthenticatedUser = None,
    db: DbSession = None,
):
    """Retrieve all detection rule configurations. Requires authenticated session."""
    rules = await RuleEngineService.get_all_rules(session=db)
    data = [RuleConfigResponse.model_validate(r).model_dump() for r in rules]
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Detection rules retrieved successfully",
        data=data,
    )


@router.get("/{rule_code}", response_model=None)
async def get_rule(
    rule_code: str,
    current_user: AuthenticatedUser = None,
    db: DbSession = None,
):
    """Retrieve configuration for a specific rule code. Requires authenticated session."""
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
    current_user: PrivilegedUser,
    db: DbSession = None,
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
    current_user: AuthenticatedUser,
    db: DbSession = None,
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
