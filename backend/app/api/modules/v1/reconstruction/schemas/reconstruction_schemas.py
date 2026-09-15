"""Pydantic request & response schemas for Historical Reconstruction API.

Pure validation schemas — no business logic.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Request Schemas
# ---------------------------------------------------------------------------


class ReconstructionRequest(BaseModel):
    """Input for a historical reconstruction run."""

    transaction_id: str = Field(..., description="Target transaction ID to reconstruct.")
    event_timestamp: datetime = Field(
        ...,
        description="ISO-8601 timestamp of the event to reconstruct state at.",
    )
    case_id: str | None = Field(
        default=None,
        description="Optional associated risk case ID for traceability.",
    )


# ---------------------------------------------------------------------------
# Component Provenance Schemas
# ---------------------------------------------------------------------------


class ProvenanceFact(BaseModel):
    """A single reconstructed fact with full provenance metadata."""

    field: str = Field(..., description="Name of the reconstructed field.")
    value: Any = Field(..., description="Value of the field as-of the event timestamp.")
    source_record_id: str = Field(..., description="ID of the source record this fact came from.")
    source_table: str = Field(..., description="Table/entity type the fact was drawn from.")
    effective_from: datetime | None = Field(
        default=None, description="When this value became effective."
    )
    recorded_at: datetime | None = Field(default=None, description="When TRIS recorded this value.")


class SupplierStateAtEvent(BaseModel):
    """Reconstructed supplier master-data state as-of the event timestamp."""

    supplier_id: str
    name: str | None
    category: str | None
    risk_tier: str | None
    bank_change_date: str | None  # date as ISO string, nullable
    bank_changed_within_7_days: bool
    provenance: list[ProvenanceFact] = Field(default_factory=list)


class ApprovalStateAtEvent(BaseModel):
    """Reconstructed approval state as-of the event timestamp."""

    effective_approvals: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Approvals recorded at or before the event timestamp.",
    )
    excluded_late_approvals: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Approvals excluded because they were recorded AFTER the event timestamp.",
    )
    highest_effective_level: str | None = Field(
        default=None,
        description="Highest approval level among effective (pre-event) approvals.",
    )
    provenance: list[ProvenanceFact] = Field(default_factory=list)


class AccessStateAtEvent(BaseModel):
    """Reconstructed access/authority state as-of the event timestamp."""

    elevated_access_active: bool = Field(
        ...,
        description="True if any elevated-access grant was active at the event timestamp.",
    )
    active_access_events: list[dict[str, Any]] = Field(default_factory=list)
    provenance: list[ProvenanceFact] = Field(default_factory=list)


class TransactionStateAtEvent(BaseModel):
    """Reconstructed transaction/operational state as-of the event timestamp."""

    transaction_id: str
    amount: float
    currency: str
    invoice_date: str
    approval_required: bool
    approval_status_at_event: str
    provenance: list[ProvenanceFact] = Field(default_factory=list)


class ApplicableRuleAtEvent(BaseModel):
    """The rule version that was applicable at the event timestamp."""

    rule_code: str
    rule_name: str
    rule_version: int
    threshold_params: dict[str, Any]
    provenance: list[ProvenanceFact] = Field(default_factory=list)


class EvidenceCompleteness(BaseModel):
    """Summary of evidence completeness across all reconstruction domains."""

    supplier_state: str  # "COMPLETE" | "PARTIAL" | "MISSING"
    approval_state: str  # "COMPLETE" | "PARTIAL" | "MISSING"
    access_state: str  # "COMPLETE" | "PARTIAL" | "MISSING"
    transaction_state: str  # "COMPLETE" | "PARTIAL" | "MISSING"
    rule_version: str  # "COMPLETE" | "PARTIAL" | "MISSING"
    overall: str  # "COMPLETE" | "PARTIAL" | "MISSING"


# ---------------------------------------------------------------------------
# Response Schemas
# ---------------------------------------------------------------------------


class ReconstructionResult(BaseModel):
    """Full historical reconstruction result payload.

    Every field carries provenance. Outcome is PASS | FAIL | UNKNOWN.
    UNKNOWN is returned when required evidence is missing — never defaults to PASS.
    """

    transaction_id: str
    case_id: str | None
    event_timestamp: datetime

    # Top-level determination
    outcome: str = Field(..., description="PASS | FAIL | UNKNOWN")
    explanation: str = Field(..., description="Plain-language reason for the outcome.")

    # Per-domain reconstructed state
    supplier_state: SupplierStateAtEvent | None = None
    approval_state: ApprovalStateAtEvent | None = None
    access_state: AccessStateAtEvent | None = None
    transaction_state: TransactionStateAtEvent | None = None
    applicable_rule: ApplicableRuleAtEvent | None = None

    # Completeness summary
    evidence_completeness: EvidenceCompleteness

    # Snapshot ID if persisted to DB
    snapshot_id: int | None = None
