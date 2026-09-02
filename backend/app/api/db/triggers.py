"""
PostgreSQL Database Triggers for TRIS.
Enforces Case_History immutability at the database engine level.
"""

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("tris.triggers")

CASE_HISTORY_IMMUTABILITY_SQL = """
CREATE OR REPLACE FUNCTION prevent_case_history_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Case_History rows are immutable: UPDATE and DELETE operations are prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_case_history_immutable ON case_history;

CREATE TRIGGER trg_case_history_immutable
    BEFORE UPDATE OR DELETE ON case_history
    FOR EACH ROW EXECUTE FUNCTION prevent_case_history_mutation();
"""


async def apply_database_triggers(session: AsyncSession) -> None:
    """
    Applies database-level triggers if running on PostgreSQL.
    Safely bypassed on SQLite.
    """
    bind = session.get_bind()
    if bind.dialect.name == "postgresql":
        try:
            await session.execute(text(CASE_HISTORY_IMMUTABILITY_SQL))
            await session.commit()
            logger.info("Successfully applied case_history immutability trigger")
        except Exception as e:
            logger.warning(f"Could not apply PostgreSQL trigger: {e}")
            await session.rollback()
