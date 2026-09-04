"""
TRIS Database Seeder CLI Script.
Initializes tables, seeds demo personas with Argon2id passwords, and ingests synthetic Excel data.

Usage:
    uv run python -m app.scripts.seed --data-file "../test data.xlsx"
"""

import argparse
import asyncio
import logging
from pathlib import Path

from sqlmodel import select

from app.api.core.security import get_password_hash
from app.api.db.database import async_session_factory, create_db_and_tables
from app.api.db.triggers import apply_database_triggers
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("tris.seed")

DEMO_PERSONAS = [
    {
        "user_id": "usr-reviewer-01",
        "username": "reviewer",
        "name": "Risk Reviewer",
        "email": "reviewer@tris.internal",
        "password": "password123",
        "role": "Reviewer",
        "department": "Finance",
    },
    {
        "user_id": "usr-verifier-02",
        "username": "verifier",
        "name": "Compliance Verifier",
        "email": "verifier@tris.internal",
        "password": "password123",
        "role": "Verifier",
        "department": "Compliance",
    },
    {
        "user_id": "usr-admin-03",
        "username": "admin",
        "name": "System Administrator",
        "email": "admin@tris.internal",
        "password": "admin123",
        "role": "Admin",
        "department": "Risk Management",
    },
    {
        "user_id": "usr-cfo-04",
        "username": "sarah",
        "name": "Sarah Chen",
        "email": "sarah@company.com",
        "password": "password",
        "role": "CFO",
        "department": "Finance",
    },
    {
        "user_id": "usr-proc-05",
        "username": "james",
        "name": "James Wilson",
        "email": "james@company.com",
        "password": "password",
        "role": "Procurement",
        "department": "Procurement",
    },
    {
        "user_id": "usr-comp-06",
        "username": "maria",
        "name": "Maria Garcia",
        "email": "maria@company.com",
        "password": "password",
        "role": "Compliance",
        "department": "Compliance",
    },
    {
        "user_id": "usr-sec-07",
        "username": "david",
        "name": "David Kim",
        "email": "david@company.com",
        "password": "password",
        "role": "Security",
        "department": "Security",
    },
]


async def seed_users(session) -> int:
    """Seed initial demo users with Argon2id password hashes."""
    count = 0
    for persona in DEMO_PERSONAS:
        stmt = select(User).where(User.username == persona["username"])
        res = await session.execute(stmt)
        existing = res.scalar_one_or_none()

        if not existing:
            user = User(
                user_id=persona["user_id"],
                username=persona["username"],
                name=persona["name"],
                email=persona["email"],
                hashed_password=get_password_hash(persona["password"]),
                role=persona["role"],
                department=persona["department"],
                is_active=True,
            )
            session.add(user)
            count += 1
            logger.info(f"Created demo user: {persona['username']} ({persona['role']})")
    await session.commit()
    return count


async def seed_initial_notifications(session) -> int:
    """Seed sample notifications if notifications table is empty."""
    from app.api.modules.v1.notifications.models.notification import Notification
    from app.api.modules.v1.notifications.service.notification_service import NotificationService

    stmt = select(Notification).limit(1)
    existing = (await session.execute(stmt)).scalar_one_or_none()
    if existing:
        return 0

    samples = [
        {
            "title": "High-Risk Invoice Detected",
            "message": (
                "Invoice NC-260828 ($104,000.00) from Northstar Components LLC "
                "flagged for deviation & bank change."
            ),
            "category": "CASE_ALERT",
            "severity": "CRITICAL",
            "link_url": "/cases/TEST-CASE-001",
            "recipient_role": "compliance",
        },
        {
            "title": "Duplicate Invoice Flagged",
            "message": (
                "Potential duplicate invoice pair TX-4001 and TX-4002 ($78,000.00) detected on "
                "supplier SUP-004."
            ),
            "category": "CASE_ALERT",
            "severity": "WARNING",
            "link_url": "/cases/TEST-CASE-002",
            "recipient_role": "Reviewer",
        },
        {
            "title": "Off-Hours Security Telemetry",
            "message": (
                "Unusual after-hours access (23:42) recorded for user USR-204 modifying supplier "
                "banking records."
            ),
            "category": "SECURITY_EVENT",
            "severity": "WARNING",
            "link_url": "/zero-trust",
            "recipient_role": "admin",
        },
        {
            "title": "Dataset Ingestion Completed",
            "message": (
                "Master supplier baseline dataset processed cleanly. 100 suppliers and 619 "
                "invoices loaded."
            ),
            "category": "INGESTION_JOB",
            "severity": "SUCCESS",
            "link_url": "/ingestion",
        },
    ]

    for s in samples:
        await NotificationService.emit(
            db=session,
            title=s["title"],
            message=s["message"],
            category=s["category"],
            severity=s["severity"],
            link_url=s.get("link_url"),
            recipient_role=s.get("recipient_role"),
        )
    await session.commit()
    return len(samples)


async def seed_users_and_triggers() -> int:
    """Create database tables, seed system users, and apply DB triggers."""
    logger.info("1. Verifying database tables exist...")
    await create_db_and_tables()

    async with async_session_factory() as session:
        logger.info("2. Seeding default user personas...")
        user_count = await seed_users(session)
        logger.info(f"   -> Seeded {user_count} users")

        logger.info("3. Applying database triggers...")
        await apply_database_triggers(session)

        logger.info("4. Seeding initial notification records...")
        notif_count = await seed_initial_notifications(session)
        logger.info(f"   -> Seeded {notif_count} notifications")

    logger.info("User, trigger, and notification setup complete.")
    return user_count


async def ingest_workbook_data(data_file_path: str | Path) -> dict:
    """Ingest synthetic or enterprise data from an Excel workbook."""
    file_path = Path(data_file_path).resolve()
    if not file_path.exists():
        # Check alternative common location
        alt_path = Path("test data.xlsx").resolve()
        if alt_path.exists():
            file_path = alt_path
        else:
            logger.error(f"Test data file not found at: {file_path}")
            return {}

    logger.info(f"Ingesting database using Excel workbook: {file_path}")
    async with async_session_factory() as session:
        report = await IngestionService.ingest_excel_workbook(file_path, session)
        logger.info("   -> Ingestion Complete:")
        for key, value in report.items():
            logger.info(f"      - {key}: {value}")
        return report


async def main(
    data_file_path: str = "../test data.xlsx",
    users_only: bool = False,
    ingest_only: bool = False,
):
    """Orchestrates database seeding and/or ingestion."""
    if users_only:
        await seed_users_and_triggers()
        return

    if ingest_only:
        await ingest_workbook_data(data_file_path)
        return

    # Default: Run both (users + triggers + workbook ingestion)
    await seed_users_and_triggers()
    await ingest_workbook_data(data_file_path)
    logger.info("TRIS Database Seeding & Ingestion Succeeded!")


if __name__ == "__main__":
    import sys

    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    parser = argparse.ArgumentParser(description="TRIS Database Seeder and Ingestion CLI")
    parser.add_argument(
        "--data-file",
        default="../test data.xlsx",
        help="Path to test data.xlsx file",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--users-only",
        action="store_true",
        help="Only seed system users and database triggers (no Excel ingestion)",
    )
    group.add_argument(
        "--ingest-only",
        action="store_true",
        help="Only ingest the Excel workbook (assumes tables/users exist)",
    )
    args = parser.parse_args()
    asyncio.run(
        main(
            data_file_path=args.data_file,
            users_only=args.users_only,
            ingest_only=args.ingest_only,
        )
    )
