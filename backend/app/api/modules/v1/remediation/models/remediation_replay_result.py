"""Remediation Replay Results SQLModel Table.

Pure ORM model — no business logic.
Persisted output of a remediation replay run against a reconstructed historical event.
NO foreign keys to mutable case/transaction tables (isolation invariant).
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class RemediationReplayResult(SQLModel, table=True):
    """Persisted remediation replay run results.

    Records the evaluation of a proposed control against a reconstructed event state.
    Strictly append-only; has no FK to mutable case/transaction fields to guarantee isolation.
    """

    __tablename__ = "remediation_replay_results"

    replay_id: int | None = Field(default=None, primary_key=True)

    # Identifiers (lookup keys, decoupled from FKs)
    control_id: str = Field(index=True, max_length=50)
    transaction_id: str = Field(index=True, max_length=50)
    case_id: str | None = Field(default=None, index=True, nullable=True, max_length=50)

    # The reconstructed event timestamp evaluated against
    event_timestamp: datetime = Field(index=True)

    # Replay determination: strictly ALLOW | ESCALATE/HOLD | BLOCK/PREVENT | NOT DETERMINABLE
    replay_determination: str = Field(index=True, max_length=50)

    # Side-by-side comparison outcomes
    original_outcome: str = Field(max_length=20)
    proposed_control_outcome: str = Field(max_length=50)

    # Plain-language explanation with driving facts and provenance
    explanation: str = Field(max_length=3000)

    # Specific historical facts that drove the replay result (provenance)
    driving_facts: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )

    # Full payload (side-by-side comparison, reconstruction state, control parameters)
    replay_payload: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )

    reconstruction_snapshot_id: int | None = Field(default=None, nullable=True)
    executed_by: str | None = Field(default=None, nullable=True, max_length=100)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
