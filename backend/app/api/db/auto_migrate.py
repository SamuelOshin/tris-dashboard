"""
Optional migration at start-up (`AUTO_MIGRATE=true`; off by default).

For environments with no release step to run `alembic upgrade head` (for example a demo on a
platform without a pre-deploy command). When several instances start together, one takes a
PostgreSQL advisory lock and migrates while the others wait for it, then each finds the database
current. A failed migration stops start-up with the error; PostgreSQL rolls back the step that
failed, so the database stays at the last revision that finished.

Do not turn this on for a database whose data cannot be recreated: take a backup and migrate in a
separate release step instead.
"""

import asyncio
import logging
import os
import subprocess
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.api.db.schema_check import BACKEND_DIR

logger = logging.getLogger("tris.migrate")
LOCK_KEY = 7_314_920_001  # any constant shared by every instance
MIGRATION_TIMEOUT_SECONDS = 600


class MigrationFailedError(RuntimeError):
    """`alembic upgrade head` did not finish."""


async def run_auto_migration(engine: AsyncEngine) -> None:
    """
    Bring the database to the newest migration, one instance at a time.

    Raises:
        MigrationFailedError: If the migration command fails (its output is in the message).
    """
    async with engine.connect() as conn:
        await conn.execute(text("SELECT pg_advisory_lock(:key)"), {"key": LOCK_KEY})
        try:
            logger.info("AUTO_MIGRATE is on: applying migrations (this instance holds the lock).")
            result = await asyncio.to_thread(  # a thread: works on every event-loop policy
                subprocess.run,
                [sys.executable, "-m", "alembic", "upgrade", "head"],
                cwd=str(BACKEND_DIR),
                env=_environment(engine),
                capture_output=True,
                text=True,
                timeout=MIGRATION_TIMEOUT_SECONDS,
            )
            if result.returncode != 0:
                tail = (result.stdout + result.stderr)[-2000:]
                raise MigrationFailedError(f"`alembic upgrade head` failed:\n{tail}")
            logger.info("Migrations applied.")
        finally:
            await conn.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": LOCK_KEY})


def _environment(engine: AsyncEngine) -> dict[str, str]:
    return {
        **os.environ,
        "DATABASE_URL": engine.url.render_as_string(hide_password=False),
        "PYTHONUTF8": "1",
    }
