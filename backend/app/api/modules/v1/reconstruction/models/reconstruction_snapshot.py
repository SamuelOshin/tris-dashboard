"""Historical Reconstruction SQLModel Tables.

Pure ORM model — no business logic.
Two tables:
  - ReconstructionSnapshot: persisted output of a reconstruction run.
No FK back into mutable case fields — replay results are append-only.
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class ReconstructionSnapshot(SQLModel, table=True):
    """Persisted historical reconstruction results.

    Each row records the full reconstruction at a given event_timestamp
    for a given transaction. Append-only; never mutates original case data.
    """

    __tablename__ = "reconstruction_snapshots"

    snapshot_id: int | None = Field(default=None, primary_key=True)

    # Input identifiers (lookup keys)
    transaction_id: str = Field(index=True, max_length=50)
    case_id: str | None = Field(default=None, index=True, nullable=True, max_length=50)

    # The exact timestamp this reconstruction targets
    event_timestamp: datetime = Field(index=True)

    # Top-level outcome: PASS | FAIL | UNKNOWN
    outcome: str = Field(max_length=20)

    # Human-readable plain-language explanation
    explanation: str = Field(max_length=2000)

    # Complete provenance-carrying reconstruction payload (JSON)
    reconstruction_payload: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )

    # Rule version applicable at event_timestamp
    applicable_rule_version: int | None = Field(default=None, nullable=True)
    applicable_rule_code: str | None = Field(default=None, nullable=True, max_length=50)

    # Evidence completeness flags
    evidence_completeness: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
