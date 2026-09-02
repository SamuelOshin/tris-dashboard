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
        "name": "A. Reviewer",
        "email": "reviewer@tris.internal",
        "password": "password123",
        "role": "Reviewer",
        "department": "Finance",
    },
    {
        "user_id": "usr-verifier-02",
        "username": "verifier",
        "name": "B. Verifier",
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


async def main(data_file_path: str):
    logger.info("1. Creating database tables if not existing...")
    await create_db_and_tables()

    file_path = Path(data_file_path).resolve()
    if not file_path.exists():
        # Check alternative common location
        alt_path = Path("test data.xlsx").resolve()
        if alt_path.exists():
            file_path = alt_path
        else:
            logger.error(f"Test data file not found at: {file_path}")
            return

    logger.info(f"2. Seeding database using Excel workbook: {file_path}")
    async with async_session_factory() as session:
        # Seed users
        user_count = await seed_users(session)
        logger.info(f"   -> Seeded {user_count} users")

        # Ingest Excel sheets
        report = await IngestionService.ingest_excel_workbook(file_path, session)
        logger.info("   -> Ingestion Complete:")
        for key, value in report.items():
            logger.info(f"      - {key}: {value}")

        # Apply PostgreSQL triggers
        logger.info("3. Applying database triggers...")
        await apply_database_triggers(session)

    logger.info("TRIS Database Seeding Succeeded!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TRIS Database Seeder")
    parser.add_argument(
        "--data-file",
        default="../test data.xlsx",
        help="Path to test data.xlsx file",
    )
    args = parser.parse_args()
    asyncio.run(main(args.data_file))
