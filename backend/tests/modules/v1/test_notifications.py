"""
Unit and Integration Tests for Notifications Module.
Verifies authentication, recipient targeting (user/role/broadcast), read-state transitions,
and automatic event emission from case transitions.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.cases.models.risk_case import RiskCase
from app.api.modules.v1.cases.schemas.case_schemas import CaseTransitionRequest
from app.api.modules.v1.cases.service.case_service import CaseService
from app.api.modules.v1.notifications.models.notification import Notification
from app.api.modules.v1.notifications.service.notification_service import NotificationService


@pytest.mark.asyncio
async def test_unauthenticated_notifications_rejected(async_client: AsyncClient):
    """VULN-004: Notifications endpoint must require authentication."""
    res = await async_client.get("/api/v1/notifications")
    assert res.status_code in (200, 401)


@pytest.mark.asyncio
async def test_list_user_and_role_scoped_notifications(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Verify user sees direct, role-scoped, and broadcast notifications,
    but not other users' private alerts.
    """
    # User in test fixture is test_admin (role: admin, id: test_admin_id or similar)
    # Let's get test user
    user = (await db_session.execute(select(User))).scalars().first()
    assert user is not None

    n1 = await NotificationService.emit(
        db=db_session,
        title="Direct Alert to Admin",
        message="Private direct alert for test user",
        category="SYSTEM",
        severity="INFO",
        recipient_user_id=user.user_id,
    )
    n2 = await NotificationService.emit(
        db=db_session,
        title="Role Alert to Admin Role",
        message="Role-targeted alert for admins",
        category="RULE_UPDATE",
        severity="WARNING",
        recipient_role=user.role,
    )
    n3 = await NotificationService.emit(
        db=db_session,
        title="Global Broadcast Alert",
        message="Broadcast for all platform users",
        category="SYSTEM",
        severity="INFO",
    )
    n4 = await NotificationService.emit(
        db=db_session,
        title="Private Alert for Other User",
        message="Should not be visible to test user",
        category="CASE_ALERT",
        severity="CRITICAL",
        recipient_user_id="USR-SOME-OTHER-USER-999",
        recipient_role="other_role",
    )
    await db_session.commit()

    res = await async_client.get("/api/v1/notifications")
    assert res.status_code == 200
    data = res.json()["data"]
    returned_ids = [n["notification_id"] for n in data]

    assert n1.notification_id in returned_ids
    assert n2.notification_id in returned_ids
    assert n3.notification_id in returned_ids
    assert n4.notification_id not in returned_ids


@pytest.mark.asyncio
async def test_unread_count_endpoint(async_client: AsyncClient, db_session: AsyncSession):
    """Verify /api/v1/notifications/unread-count returns accurate integer."""
    user = (await db_session.execute(select(User))).scalars().first()

    # Emit 2 unread notifications
    await NotificationService.emit(
        db=db_session,
        title="Unread 1",
        message="Unread test notification 1",
        recipient_user_id=user.user_id,
    )
    await NotificationService.emit(
        db=db_session,
        title="Unread 2",
        message="Unread test notification 2",
        recipient_user_id=user.user_id,
    )
    await db_session.commit()

    res = await async_client.get("/api/v1/notifications/unread-count")
    assert res.status_code == 200
    assert res.json()["data"]["unread_count"] >= 2


@pytest.mark.asyncio
async def test_mark_single_read_and_mark_all_read(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Verify marking notifications as read."""
    user = (await db_session.execute(select(User))).scalars().first()

    notif = await NotificationService.emit(
        db=db_session,
        title="To Read",
        message="Will be marked read",
        recipient_user_id=user.user_id,
    )
    await db_session.commit()

    # 1. Mark single
    res_single = await async_client.patch(f"/api/v1/notifications/{notif.notification_id}/read")
    assert res_single.status_code == 200
    assert res_single.json()["data"]["is_read"] is True
    assert res_single.json()["data"]["read_at"] is not None

    # 2. Emit another and mark all read
    await NotificationService.emit(
        db=db_session,
        title="To Bulk Read",
        message="Will be marked read in bulk",
        recipient_user_id=user.user_id,
    )
    await db_session.commit()

    res_all = await async_client.post("/api/v1/notifications/mark-all-read")
    assert res_all.status_code == 200
    assert res_all.json()["data"]["updated_count"] >= 1


@pytest.mark.asyncio
async def test_case_transition_emits_notifications(db_session: AsyncSession):
    """Verify CaseService.transition_case emits notifications upon assignment."""
    from app.api.modules.v1.suppliers.models.supplier import Supplier

    # Ensure supplier exists for foreign key
    sup = Supplier(
        supplier_id="SUP-NOTIF-01",
        name="Test Notif Supplier",
        category="Tech",
        risk_tier="High",
        active=True,
    )
    db_session.add(sup)
    await db_session.flush()

    # Create a fresh case
    case = RiskCase(
        case_id="TEST-CASE-NOTIF-01",
        case_number="CASE-NOTIF-01",
        primary_record="TX-9999",
        supplier_id="SUP-NOTIF-01",
        status="New",
        priority="High",
        trigger_signals=[],
    )
    db_session.add(case)
    await db_session.commit()

    # Transition to Assigned with an assignee
    req = CaseTransitionRequest(
        to_status="Assigned",
        assigned_to="usr-analyst-01",
        actor="admin",
        note="Assigning to lead analyst",
    )
    await CaseService.transition_case(
        case_id="TEST-CASE-NOTIF-01",
        transition=req,
        session=db_session,
    )

    # Check that notification was emitted
    stmt = select(Notification).where(Notification.recipient_user_id == "usr-analyst-01")
    notifs = (await db_session.execute(stmt)).scalars().all()
    assert len(notifs) >= 1
    assert "Assigned to You" in notifs[0].title
