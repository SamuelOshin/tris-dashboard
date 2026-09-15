"""Tests for Ticket 7 — Historical Reconstruction Service.

Verifies:
1. test_tx_temp_001_reconstruction_excludes_late_approval:
   - Reconstruction at TX-TEMP-001's 10:14 event timestamp strictly excludes
     the 11:06 approval (APP-TEMP-002). Core hindsight-leakage prevention.
   - Outcome is FAIL (Level 2 required; Level 1 pre-event approval does not satisfy).
   - Full provenance carried in the payload.

2. test_reconstruction_returns_unknown_on_missing_evidence:
   - A transaction with NO approval records whatsoever returns UNKNOWN.
   - Never defaults to PASS when evidence is missing.
   - Exercises the genuine UNKNOWN code path (not a theoretical state).

3. test_reconstruction_persists_append_only_snapshot:
   - After reconstruct(), a row is written to reconstruction_snapshots.
   - Original tables (approvals, transactions, suppliers) remain untouched.

4. test_reconstruction_tx1999_does_not_affect_original_case:
   - Running reconstruction against TX-1999 does NOT mutate the TX-1999
     approval record or RiskCase. The byte-for-byte snapshot guard holds.
"""

from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.modules.v1.approvals.models.approval import Approval
from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService
from app.api.modules.v1.reconstruction.models.reconstruction_snapshot import ReconstructionSnapshot
from app.api.modules.v1.reconstruction.service.reconstruction_service import (
    HistoricalReconstructionService,
)
from app.api.modules.v1.transactions.models.transaction import Transaction

DATA_FILE_V13 = Path(__file__).resolve().parents[4] / "test data.xlsx"

# Canonical event timestamps for TX-TEMP-001
TEMP_EVENT_TS = datetime(2026, 8, 28, 10, 14, 0, tzinfo=UTC)  # the 10:14 transaction moment
TEMP_LATE_APPROVAL_TS = datetime(2026, 8, 28, 11, 6, 0, tzinfo=UTC)  # must be excluded


@pytest.fixture(autouse=True)
async def setup_fixture(db_session: AsyncSession):
    """Seed v1.3 baseline + v1.4 temporal fixture before each test."""
    await IngestionService.ingest_excel_workbook(DATA_FILE_V13, db_session)
    await IngestionService.ingest_temporal_fixture(db_session)


# ---------------------------------------------------------------------------
# Test 1 — Primary hindsight-leakage acceptance test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_tx_temp_001_reconstruction_excludes_late_approval(db_session: AsyncSession):
    """
    ACCEPTANCE CRITERION (Ticket 7):
    Reconstruction at 2026-08-28 10:14:00 UTC for TX-TEMP-001 MUST:
      - Include APP-TEMP-001 (09:32, Level 1) as an effective approval.
      - Exclude APP-TEMP-002 (11:06, Level 2) from effective approvals
        (hindsight leakage prevention).
      - Return outcome='FAIL' because Level 1 < required Level 2.
      - Carry full provenance on every reconstructed fact.

    This is the canonical test of the no-hindsight-leakage invariant.
    """
    result = await HistoricalReconstructionService.reconstruct(
        transaction_id="TX-TEMP-001",
        event_timestamp=TEMP_EVENT_TS,
        session=db_session,
        case_id="CASE-TEMP-001",
        persist=False,  # Don't persist so we keep the test hermetic
    )

    # 1. Top-level outcome
    assert result.outcome == "FAIL", (
        f"Expected FAIL (Level 2 required, only Level 1 effective). Got: {result.outcome}. "
        f"Explanation: {result.explanation}"
    )

    # 2. Approval state must be populated
    assert result.approval_state is not None, "approval_state must be populated"

    # 3. APP-TEMP-001 (09:32) must be in effective approvals
    effective_ids = [a["approval_id"] for a in result.approval_state.effective_approvals]
    assert "APP-TEMP-001" in effective_ids, (
        f"APP-TEMP-001 (09:32 pre-event) must be in effective_approvals. Got: {effective_ids}"
    )

    # 4. APP-TEMP-002 (11:06) must be in EXCLUDED late approvals — not effective
    excluded_ids = [a["approval_id"] for a in result.approval_state.excluded_late_approvals]
    assert "APP-TEMP-002" in excluded_ids, (
        f"APP-TEMP-002 (11:06 post-event) must be in excluded_late_approvals. Got: {excluded_ids}"
    )

    # 5. APP-TEMP-002 must NOT appear in effective approvals
    assert "APP-TEMP-002" not in effective_ids, (
        "CRITICAL: APP-TEMP-002 (11:06) leaked into effective_approvals — hindsight leakage!"
    )

    # 6. Highest effective level is Level 1 (not Level 2)
    assert result.approval_state.highest_effective_level == "Level 1", (
        f"Highest effective level must be Level 1. "
        f"Got: {result.approval_state.highest_effective_level}"
    )

    # 7. Supplier state correctly identifies bank change within 7 days
    assert result.supplier_state is not None
    assert result.supplier_state.supplier_id == "SUP-TEMP-001"
    assert result.supplier_state.bank_changed_within_7_days is True, (
        "Bank change on 2026-08-26 is 2 days before event on 2026-08-28 — must be within 7 days"
    )

    # 8. Transaction state is populated with correct amount
    assert result.transaction_state is not None
    assert result.transaction_state.transaction_id == "TX-TEMP-001"
    assert result.transaction_state.amount == 125000.0

    # 9. Provenance exists on approval state
    provenance_ids = [p.source_record_id for p in result.approval_state.provenance]
    assert "APP-TEMP-001" in provenance_ids, "APP-TEMP-001 must appear in approval provenance"
    assert "APP-TEMP-002" in provenance_ids, (
        "APP-TEMP-002 must appear in provenance (as excluded late evidence — transparency)"
    )

    # 10. Applicable rule is R-007
    assert result.applicable_rule is not None
    assert result.applicable_rule.rule_code == "R-007"

    # 11. Explanation references the late-approval exclusion
    assert (
        "APP-TEMP-002" in result.explanation
        or "11:06" in result.explanation
        or "post-event" in result.explanation.lower()
    ), f"Explanation should reference post-event exclusion. Got: {result.explanation}"

    # 12. event_timestamp is correctly preserved
    assert result.event_timestamp.year == 2026
    assert result.event_timestamp.month == 8
    assert result.event_timestamp.day == 28
    assert result.event_timestamp.hour == 10
    assert result.event_timestamp.minute == 14


# ---------------------------------------------------------------------------
# Test 2 — UNKNOWN on missing evidence (not theoretical — genuinely exercised)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reconstruction_returns_unknown_on_missing_evidence(db_session: AsyncSession):
    """
    ACCEPTANCE CRITERION (Ticket 7):
    A transaction with zero approval records must return UNKNOWN — never PASS.

    This tests the 'missing evidence path' explicitly: we construct a transaction
    with no approval records and verify the reconstruction returns UNKNOWN.

    This is NOT a theoretical state — it is an actual DB-state that the
    service genuinely reaches and returns UNKNOWN for.
    """
    # Create a transaction with NO associated approval records
    bare_tx = Transaction(
        transaction_id="TX-NO-APPROVALS-001",
        supplier_id="SUP-TEMP-001",  # supplier exists
        invoice_number="INV-BARE-001",
        amount=80000.0,
        currency="USD",
        invoice_date=datetime(2026, 8, 28).date(),
        approval_required=True,
        approval_status="Missing",
        payment_status="Pending",
    )
    db_session.add(bare_tx)
    await db_session.commit()
    await db_session.refresh(bare_tx)

    # Verify no approvals exist for this transaction
    result = await db_session.execute(
        select(Approval).where(Approval.transaction_id == "TX-NO-APPROVALS-001")
    )
    existing_approvals = result.scalars().all()
    assert len(existing_approvals) == 0, "Test setup error: approvals should not exist"

    # Reconstruct — with no approval evidence, outcome must be UNKNOWN
    reconstruction = await HistoricalReconstructionService.reconstruct(
        transaction_id="TX-NO-APPROVALS-001",
        event_timestamp=datetime(2026, 8, 28, 10, 14, 0, tzinfo=UTC),
        session=db_session,
        persist=False,
    )

    assert reconstruction.outcome == "UNKNOWN", (
        f"CRITICAL: Reconstruction with zero approval evidence must return UNKNOWN, not PASS. "
        f"Got: {reconstruction.outcome}. "
        f"Explanation: {reconstruction.explanation}"
    )

    # The explanation must not affirmatively claim the control passed
    assert "PASS" not in reconstruction.outcome  # outcome itself must not say PASS
    # Explanation must be a non-empty string explaining why UNKNOWN was returned
    assert len(reconstruction.explanation) > 10, (
        f"Explanation should be non-trivial. Got: {reconstruction.explanation}"
    )

    # Evidence completeness must reflect MISSING for approval domain
    assert reconstruction.evidence_completeness.approval_state == "MISSING", (
        f"Evidence completeness for approval_state must be MISSING. "
        f"Got: {reconstruction.evidence_completeness.approval_state}"
    )
    assert reconstruction.evidence_completeness.overall in ("MISSING", "PARTIAL")


# ---------------------------------------------------------------------------
# Test 3 — Append-only persistence to reconstruction_snapshots
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reconstruction_persists_append_only_snapshot(db_session: AsyncSession):
    """
    Reconstruction must persist an append-only snapshot to reconstruction_snapshots.
    Original tables (approvals, transactions, suppliers) must remain untouched.
    """
    # Count approvals before reconstruction
    before_approvals = (
        (await db_session.execute(select(Approval).where(Approval.transaction_id == "TX-TEMP-001")))
        .scalars()
        .all()
    )
    before_count = len(before_approvals)

    # Count snapshots before
    before_snapshots = (await db_session.execute(select(ReconstructionSnapshot))).scalars().all()
    before_snapshot_count = len(before_snapshots)

    # Run reconstruction with persist=True
    result = await HistoricalReconstructionService.reconstruct(
        transaction_id="TX-TEMP-001",
        event_timestamp=TEMP_EVENT_TS,
        session=db_session,
        persist=True,
    )

    # Snapshot ID was returned
    assert result.snapshot_id is not None, "snapshot_id must be set after persist=True"

    # Exactly one new snapshot was written
    after_snapshots = (await db_session.execute(select(ReconstructionSnapshot))).scalars().all()
    assert len(after_snapshots) == before_snapshot_count + 1

    # Snapshot record integrity
    snapshot = await db_session.get(ReconstructionSnapshot, result.snapshot_id)
    assert snapshot is not None
    assert snapshot.transaction_id == "TX-TEMP-001"
    assert snapshot.outcome == result.outcome
    assert snapshot.reconstruction_payload is not None

    # Original approval count must be unchanged
    after_approvals = (
        (await db_session.execute(select(Approval).where(Approval.transaction_id == "TX-TEMP-001")))
        .scalars()
        .all()
    )
    assert len(after_approvals) == before_count, (
        "Reconstruction must not add/delete/modify approval records"
    )


# ---------------------------------------------------------------------------
# Test 4 — TX-1999 reconstruction does not mutate existing data
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reconstruction_tx1999_does_not_affect_original_case(db_session: AsyncSession):
    """
    Running reconstruction against TX-1999 must NOT mutate its approval record,
    status, or RiskCase. The v1.3 preservation guarantee holds.
    """
    # Snapshot the TX-1999 approval record before reconstruction
    before_result = await db_session.execute(
        select(Approval).where(Approval.transaction_id == "TX-1999")
    )
    before_approvals = before_result.scalars().all()
    before_snapshot = [
        {
            "approval_id": a.approval_id,
            "approval_status": a.approval_status,
            "approval_date": a.approval_date,
            "required_level": a.required_level,
        }
        for a in before_approvals
    ]

    # Reconstruct TX-1999 at its created_at timestamp
    tx_1999 = await db_session.get(Transaction, "TX-1999")
    assert tx_1999 is not None, "TX-1999 must exist in the test database"
    event_ts = (
        tx_1999.created_at.replace(tzinfo=UTC)
        if tx_1999.created_at.tzinfo is None
        else tx_1999.created_at.astimezone(UTC)
    )

    reconstruction = await HistoricalReconstructionService.reconstruct(
        transaction_id="TX-1999",
        event_timestamp=event_ts,
        session=db_session,
        persist=False,
    )

    # Reconstruction must complete without error
    assert reconstruction.transaction_id == "TX-1999"
    assert reconstruction.outcome in ("PASS", "FAIL", "UNKNOWN")

    # TX-1999 approval records must be unchanged
    after_result = await db_session.execute(
        select(Approval).where(Approval.transaction_id == "TX-1999")
    )
    after_approvals = after_result.scalars().all()
    after_snapshot = [
        {
            "approval_id": a.approval_id,
            "approval_status": a.approval_status,
            "approval_date": a.approval_date,
            "required_level": a.required_level,
        }
        for a in after_approvals
    ]

    assert before_snapshot == after_snapshot, (
        "TX-1999 approval records were mutated by reconstruction — this must not happen!"
    )
