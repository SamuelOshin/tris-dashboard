"""Pydantic request & response schemas for Remediation Replay API.

Pure validation schemas — no business logic.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Proposed Control Schemas
# ---------------------------------------------------------------------------


class ProposedControlCreate(BaseModel):
    """Input schema for creating or configuring a proposed corrective control."""

    control_id: str = Field(
        default="PROP-CTRL-001",
        description="Unique identifier for the proposed control.",
    )
    name: str = Field(
        default="High-Value Payment Post Bank Change Verification",
        description="Human-readable title of the proposed control.",
    )
    description: str = Field(
        default=(
            "Any payment above $50,000 made within seven days of a supplier "
            "bank-account change requires independent verification before release."
        ),
        description="Clear specification of control behavior and requirements.",
    )
    amount_threshold: float = Field(
        default=50000.0,
        description="Transaction amount threshold above which control triggers.",
    )
    bank_change_window_days: int = Field(
        default=7,
        description="Days following a bank change during which control is active.",
    )
    required_approval_level: str = Field(
        default="Level 2",
        description="Required independent verification level (e.g. 'Level 2').",
    )
    action_policy: Literal["BLOCK/PREVENT", "ESCALATE/HOLD"] = Field(
        default="BLOCK/PREVENT",
        description="Action to take when control requirement is violated.",
    )
    parameters: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional extended parameters for custom simulation logic.",
    )


class ProposedControlResponse(BaseModel):
    """Response representation of a proposed control."""

    control_id: str
    name: str
    description: str
    amount_threshold: float
    bank_change_window_days: int
    required_approval_level: str
    action_policy: str
    parameters: dict[str, Any]
    version: int
    is_active: bool
    created_by: str | None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Replay Simulation Schemas
# ---------------------------------------------------------------------------


class ReplayRequest(BaseModel):
    """Input schema for running a remediation replay simulation."""

    transaction_id: str = Field(
        ...,
        description="Target transaction ID to evaluate against.",
    )
    event_timestamp: datetime | None = Field(
        default=None,
        description="Optional ISO-8601 timestamp. Defaults to canonical timestamp.",
    )
    control_id: str = Field(
        default="PROP-CTRL-001",
        description="Proposed control ID to evaluate against reconstructed state.",
    )
    case_id: str | None = Field(
        default=None,
        description="Optional associated case ID for traceability.",
    )
    persist: bool = Field(
        default=True,
        description="Whether to persist replay result to remediation_replay_results.",
    )


class ReplayResultResponse(BaseModel):
    """Response representation of a completed remediation replay run."""

    replay_id: int | None = None
    control_id: str
    transaction_id: str
    case_id: str | None = None
    event_timestamp: datetime
    replay_determination: Literal[
        "ALLOW",
        "ESCALATE/HOLD",
        "BLOCK/PREVENT",
        "NOT DETERMINABLE",
    ]
    original_outcome: str
    proposed_control_outcome: str
    explanation: str
    driving_facts: dict[str, Any] = Field(default_factory=dict)
    replay_payload: dict[str, Any] = Field(default_factory=dict)
    reconstruction_snapshot_id: int | None = None
    executed_by: str | None = None
    created_at: datetime
