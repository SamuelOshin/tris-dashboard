"""
Unit & Integration Tests for TRIS v1.4 Temporal Fixture Isolation.
Verifies SUP-TEMP-001 and TX-TEMP-001 synthetic data, exact six-event timeline,
independent round-trip ingestion, and absolute non-mutation of v1.3 TX-1999 / SUP-001 records.
"""

from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.modules.v1.access_events.models.access_event import AccessEvent
from app.api.modules.v1.approvals.models.approval import Approval
from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService
from app.api.modules.v1.ingestion.service.temporal_fixture_service import (
    TIMELINE_EVENTS,
)
from app.api.modules.v1.rules.service.rule_engine_service import RuleEngineService
from app.api.modules.v1.suppliers.models.supplier import Supplier
from app.api.modules.v1.transactions.models.transaction import Transaction

DATA_FILE_V13 = Path(__file__).resolve().parents[4] / "test data.xlsx"


@pytest.mark.asyncio
async def test_temporal_fixture_loading_and_roundtrip(db_session: AsyncSession):
    """
    Verifies that the v1.4 temporal fixture loads cleanly through IngestionService
    and maps correctly into relational tables.
    """
    report = await IngestionService.ingest_temporal_fixture(db_session)
    assert report["suppliers_loaded"] == 1
    assert report["transactions_loaded"] == 1
    assert report["approvals_loaded"] == 2
    assert report["access_events_loaded"] == 3

    # 1. Supplier SUP-TEMP-001
    supplier = (
        await db_session.execute(select(Supplier).where(Supplier.supplier_id == "SUP-TEMP-001"))
    ).scalar_one_or_none()
    assert supplier is not None
    assert supplier.name == "Apex Temporal Technologies Ltd"
    assert supplier.category == "Cloud & IT Services"
    assert supplier.risk_tier == "High"
    assert supplier.bank_change_date == date(2026, 8, 26)
    assert supplier.bank_change_reason == "Supplier banking profile update"
    assert supplier.status == "Active"

    # 2. Transaction TX-TEMP-001
    tx = (
        await db_session.execute(
            select(Transaction).where(Transaction.transaction_id == "TX-TEMP-001")
        )
    ).scalar_one_or_none()
    assert tx is not None
    assert tx.supplier_id == "SUP-TEMP-001"
    assert tx.amount == 125000.0
    assert tx.invoice_date == date(2026, 8, 28)
    assert tx.posting_date == date(2026, 8, 28)
    assert tx.approval_required is True
    assert tx.approval_status == "Approved"

    # 3. Approvals (2 rows)
    approvals = (
        (
            await db_session.execute(
                select(Approval)
                .where(Approval.transaction_id == "TX-TEMP-001")
                .order_by(Approval.approval_date)
            )
        )
        .scalars()
        .all()
    )
    assert len(approvals) == 2

    def to_utc(dt: datetime) -> datetime:
        return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)

    # First approval (pre-event, 09:32)
    app1 = approvals[0]
    assert app1.approval_id == "APP-TEMP-001"
    assert app1.required_level == "Level 1"
    assert app1.approval_status == "Approved"
    assert to_utc(app1.approval_date) == datetime(2026, 8, 28, 9, 32, 0, tzinfo=UTC)

    # Second approval (post-event, 11:06)
    app2 = approvals[1]
    assert app2.approval_id == "APP-TEMP-002"
    assert app2.required_level == "Level 2"
    assert app2.approval_status == "Approved"
    assert to_utc(app2.approval_date) == datetime(2026, 8, 28, 11, 6, 0, tzinfo=UTC)

    # 4. Access Events (3 rows)
    access_events = (
        (
            await db_session.execute(
                select(AccessEvent)
                .where(AccessEvent.supplier_id == "SUP-TEMP-001")
                .order_by(AccessEvent.event_time)
            )
        )
        .scalars()
        .all()
    )
    assert len(access_events) == 3
    assert access_events[0].event_id == "AE-TEMP-001"
    assert access_events[0].action == "BANK_CHANGE"
    assert to_utc(access_events[0].event_time) == datetime(2026, 8, 26, 14, 15, 0, tzinfo=UTC)

    assert access_events[1].event_id == "AE-TEMP-002"
    assert access_events[1].action == "ELEVATED_ACCESS_GRANT"
    assert to_utc(access_events[1].event_time) == datetime(2026, 8, 27, 8, 0, 0, tzinfo=UTC)

    assert access_events[2].event_id == "AE-TEMP-003"
    assert access_events[2].action == "ELEVATED_ACCESS_REVOKE"
    assert to_utc(access_events[2].event_time) == datetime(2026, 8, 30, 17, 0, 0, tzinfo=UTC)


@pytest.mark.asyncio
async def test_six_event_timeline_exactness(db_session: AsyncSession):
    """
    Verifies the exact six-event timeline specified in Consolidated Instruction Section 4:
    1. 2026-08-26 14:15 - Supplier bank change effective
    2. 2026-08-27 08:00 - Temporary access active
    3. 2026-08-28 09:32 - First required approval recorded (Level 1)
    4. 2026-08-28 10:14 - Material transaction occurs (TX-TEMP-001)
    5. 2026-08-28 11:06 - Second required approval recorded post-event (Level 2)
    6. 2026-08-30 17:00 - Temporary access removed
    """
    await IngestionService.ingest_temporal_fixture(db_session)

    # Validate the canonical TIMELINE_EVENTS definitions
    timestamps = [e["timestamp"] for e in TIMELINE_EVENTS]
    assert len(timestamps) == 6
    assert timestamps == sorted(timestamps), "Timeline events must be strictly chronological"

    # Fetch rows from DB
    ae1 = (
        await db_session.execute(select(AccessEvent).where(AccessEvent.event_id == "AE-TEMP-001"))
    ).scalar_one()
    ae2 = (
        await db_session.execute(select(AccessEvent).where(AccessEvent.event_id == "AE-TEMP-002"))
    ).scalar_one()
    app1 = (
        await db_session.execute(select(Approval).where(Approval.approval_id == "APP-TEMP-001"))
    ).scalar_one()
    app2 = (
        await db_session.execute(select(Approval).where(Approval.approval_id == "APP-TEMP-002"))
    ).scalar_one()
    ae3 = (
        await db_session.execute(select(AccessEvent).where(AccessEvent.event_id == "AE-TEMP-003"))
    ).scalar_one()

    # Define exact event timestamps
    t_bank_change = ae1.event_time.replace(tzinfo=UTC)
    t_access_grant = ae2.event_time.replace(tzinfo=UTC)
    t_app1 = app1.approval_date.replace(tzinfo=UTC)
    t_tx_event = datetime(2026, 8, 28, 10, 14, 0, tzinfo=UTC)
    t_app2 = app2.approval_date.replace(tzinfo=UTC)
    t_access_revoke = ae3.event_time.replace(tzinfo=UTC)

    # Assert exact timestamps
    assert t_bank_change == datetime(2026, 8, 26, 14, 15, 0, tzinfo=UTC)
    assert t_access_grant == datetime(2026, 8, 27, 8, 0, 0, tzinfo=UTC)
    assert t_app1 == datetime(2026, 8, 28, 9, 32, 0, tzinfo=UTC)
    assert t_app2 == datetime(2026, 8, 28, 11, 6, 0, tzinfo=UTC)
    assert t_access_revoke == datetime(2026, 8, 30, 17, 0, 0, tzinfo=UTC)

    # Assert strict ordering and time delta properties
    assert t_bank_change < t_access_grant < t_app1 < t_tx_event < t_app2 < t_access_revoke
    assert (t_tx_event - t_app1).total_seconds() == 42 * 60  # 42 mins prior
    assert (t_app2 - t_tx_event).total_seconds() == 52 * 60  # 52 mins post


@pytest.mark.asyncio
async def test_tx1999_unchanged_after_v14(db_session: AsyncSession):
    """
    MANDATORY REGRESSION GUARD:
    Proves TX-1999 and its approval record in DB/memory remain byte-for-byte and
    value-for-value identical before and after loading the v1.4 temporal fixture.
    """
    # 1. Ingest v1.3 baseline dataset
    await IngestionService.ingest_excel_workbook(DATA_FILE_V13, db_session)

    # 2. Capture TX-1999 pre-state
    tx_pre = (
        await db_session.execute(select(Transaction).where(Transaction.transaction_id == "TX-1999"))
    ).scalar_one()
    app_pre = (
        (await db_session.execute(select(Approval).where(Approval.transaction_id == "TX-1999")))
        .scalars()
        .all()
    )

    pre_snapshot = {
        "transaction_id": tx_pre.transaction_id,
        "supplier_id": tx_pre.supplier_id,
        "invoice_number": tx_pre.invoice_number,
        "amount": tx_pre.amount,
        "currency": tx_pre.currency,
        "invoice_date": tx_pre.invoice_date,
        "due_date": tx_pre.due_date,
        "posting_date": tx_pre.posting_date,
        "approval_required": tx_pre.approval_required,
        "approval_status": tx_pre.approval_status,
        "payment_status": tx_pre.payment_status,
        "description": tx_pre.description,
        "approvals": [
            {
                "approval_id": a.approval_id,
                "required_level": a.required_level,
                "approver_role": a.approver_role,
                "approval_status": a.approval_status,
                "approval_date": a.approval_date,
            }
            for a in app_pre
        ],
    }

    # Evaluate R-003 prior to v1.4 ingestion
    result_pre = await RuleEngineService.evaluate_transaction("TX-1999", db_session)
    r003_pre = next((s for s in result_pre.triggered_signals if s.rule_code == "R-003"), None)
    assert r003_pre is not None
    assert r003_pre.triggered is True
    assert r003_pre.weight == 25

    # 3. Load v1.4 temporal fixture
    await IngestionService.ingest_temporal_fixture(db_session)

    # 4. Capture TX-1999 post-state
    tx_post = (
        await db_session.execute(select(Transaction).where(Transaction.transaction_id == "TX-1999"))
    ).scalar_one()
    app_post = (
        (await db_session.execute(select(Approval).where(Approval.transaction_id == "TX-1999")))
        .scalars()
        .all()
    )

    post_snapshot = {
        "transaction_id": tx_post.transaction_id,
        "supplier_id": tx_post.supplier_id,
        "invoice_number": tx_post.invoice_number,
        "amount": tx_post.amount,
        "currency": tx_post.currency,
        "invoice_date": tx_post.invoice_date,
        "due_date": tx_post.due_date,
        "posting_date": tx_post.posting_date,
        "approval_required": tx_post.approval_required,
        "approval_status": tx_post.approval_status,
        "payment_status": tx_post.payment_status,
        "description": tx_post.description,
        "approvals": [
            {
                "approval_id": a.approval_id,
                "required_level": a.required_level,
                "approver_role": a.approver_role,
                "approval_status": a.approval_status,
                "approval_date": a.approval_date,
            }
            for a in app_post
        ],
    }

    # Byte-for-byte / value-for-value identity assertion
    assert pre_snapshot == post_snapshot, "TX-1999 was mutated by v1.4 temporal fixture!"

    # Evaluate R-003 after v1.4 ingestion
    result_post = await RuleEngineService.evaluate_transaction("TX-1999", db_session)
    r003_post = next((s for s in result_post.triggered_signals if s.rule_code == "R-003"), None)
    assert r003_post is not None
    assert r003_post.triggered is True
    assert r003_post.weight == 25
    assert r003_post.score == r003_pre.score
    assert r003_post.explanation == r003_pre.explanation


@pytest.mark.asyncio
async def test_reingest_v13_does_not_overwrite_v14_and_vice_versa(db_session: AsyncSession):
    """
    Verifies bidirectional isolation and idempotence:
    - Re-ingesting v1.3 test data does not alter SUP-TEMP-001/TX-TEMP-001.
    - Re-ingesting v1.4 temporal fixture does not alter SUP-001/TX-1999.
    """
    # 1. Ingest v1.3 data then v1.4 temporal data
    await IngestionService.ingest_excel_workbook(DATA_FILE_V13, db_session)
    await IngestionService.ingest_temporal_fixture(db_session)

    # 2. Re-ingest v1.3 data
    report_v13_reingest = await IngestionService.ingest_excel_workbook(
        DATA_FILE_V13, db_session, duplicate_strategy="skip"
    )
    # Under duplicate_strategy="skip", existing rows are preserved, 0 inserted
    assert report_v13_reingest["suppliers_loaded"] == 0
    assert report_v13_reingest["transactions_loaded"] == 0

    # Verify SUP-TEMP-001 and TX-TEMP-001 still exist intact
    sup_temp = (
        await db_session.execute(select(Supplier).where(Supplier.supplier_id == "SUP-TEMP-001"))
    ).scalar_one_or_none()
    assert sup_temp is not None
    assert sup_temp.name == "Apex Temporal Technologies Ltd"

    tx_temp = (
        await db_session.execute(
            select(Transaction).where(Transaction.transaction_id == "TX-TEMP-001")
        )
    ).scalar_one_or_none()
    assert tx_temp is not None
    assert tx_temp.amount == 125000.0

    # 3. Re-ingest v1.4 temporal fixture
    report_v14_reingest = await IngestionService.ingest_temporal_fixture(
        db_session, duplicate_strategy="skip"
    )
    assert report_v14_reingest["suppliers_loaded"] == 0
    assert report_v14_reingest["transactions_loaded"] == 0

    # Verify SUP-001 and TX-1999 still exist intact
    sup_001 = (
        await db_session.execute(select(Supplier).where(Supplier.supplier_id == "SUP-001"))
    ).scalar_one_or_none()
    assert sup_001 is not None
    assert sup_001.name == "Northstar Components LLC"

    tx_1999 = (
        await db_session.execute(select(Transaction).where(Transaction.transaction_id == "TX-1999"))
    ).scalar_one_or_none()
    assert tx_1999 is not None
    assert tx_1999.amount == 104000.0
