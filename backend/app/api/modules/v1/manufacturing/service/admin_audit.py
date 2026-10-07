"""
Audit trail of configuration and analysis actions (work plan Sections 10 and 11).

Each action writes one row to the existing `security_audit_log` (which already holds sign-ins and
rule edits) in the same transaction as the action itself, so an action and its audit entry are
saved together or not at all. The table is insert-only (database trigger). The actor always comes
from the authenticated user, never from the request.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.modules.v1.auth.models.security_audit_log import SecurityAuditLog
from app.api.modules.v1.auth.models.user import User

DATA_IMPORT = "DATA_IMPORT"
MAPPING_PROFILE_SAVED = "MAPPING_PROFILE_SAVED"
MAPPING_PROFILE_DELETED = "MAPPING_PROFILE_DELETED"
FORECAST_RUN = "FORECAST_RUN"
RISK_WEIGHTS_CREATED = "RISK_WEIGHTS_CREATED"
RISK_SCORING_RUN = "RISK_SCORING_RUN"
VALIDATION_RUN = "VALIDATION_RUN"
VALIDATION_FAILED = "VALIDATION_FAILED"
MATERIAL_CASE_OPENED = "MATERIAL_CASE_OPENED"
MODEL_SETTING_CHANGED = "MODEL_SETTING_CHANGED"
DATASET_REGISTERED = "DATASET_REGISTERED"
DATASET_LABEL_CHANGED = "DATASET_LABEL_CHANGED"

# Everything this module can write, with the name shown on screen (used for the filter list).
EVENT_LABELS: dict[str, str] = {
    DATA_IMPORT: "Data imported",
    MAPPING_PROFILE_SAVED: "Mapping saved",
    MAPPING_PROFILE_DELETED: "Mapping deleted",
    FORECAST_RUN: "Forecast run",
    RISK_WEIGHTS_CREATED: "Risk weights changed",
    RISK_SCORING_RUN: "Risk scores calculated",
    VALIDATION_RUN: "Validation run",
    VALIDATION_FAILED: "Validation did not finish",
    MATERIAL_CASE_OPENED: "Material case opened",
    MODEL_SETTING_CHANGED: "Forecast model setting changed",
    DATASET_REGISTERED: "Dataset registered",
    DATASET_LABEL_CHANGED: "Dataset label changed",
    "LOGIN_SUCCESS": "Signed in",
    "LOGIN_FAILURE": "Sign-in failed",
    "RULE_CONFIG_EDIT": "Detection rule changed",
    "USER_CREATED": "User created",
    "ROLE_PERMISSION_CHANGE": "Role changed",
}


def record(
    session: AsyncSession,
    user: User,
    event_type: str,
    resource_type: str,
    resource_id: str | None,
    detail: str,
) -> None:
    """
    Add an audit entry to the current transaction. It is saved when the caller commits.

    Args:
        session: The session the action is using.
        user: The authenticated user who did it.
        event_type: One of the constants of this module.
        resource_type: What was affected (for example "forecast_run").
        resource_id: Which one, if any.
        detail: A plain-language summary (kept to 500 characters).
    """
    session.add(
        SecurityAuditLog(
            event_type=event_type,
            actor_id=user.user_id,
            actor_username=user.username,
            actor_role=str(getattr(user.role, "value", user.role)),
            resource_type=resource_type,
            resource_id=resource_id,
            detail=detail[:500],
        )
    )
