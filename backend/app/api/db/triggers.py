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


FORECAST_RUN_IMMUTABILITY_SQL = """
CREATE OR REPLACE FUNCTION prevent_forecast_run_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'forecast_runs rows are immutable: UPDATE and DELETE are prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_forecast_runs_immutable ON forecast_runs;

CREATE TRIGGER trg_forecast_runs_immutable
    BEFORE UPDATE OR DELETE ON forecast_runs
    FOR EACH ROW EXECUTE FUNCTION prevent_forecast_run_mutation();
"""


MATERIAL_RISK_IMMUTABILITY_SQL = """
CREATE OR REPLACE FUNCTION prevent_material_risk_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% rows are immutable: UPDATE and DELETE are prohibited', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_material_risk_scores_immutable ON material_risk_scores;
CREATE TRIGGER trg_material_risk_scores_immutable
    BEFORE UPDATE OR DELETE ON material_risk_scores
    FOR EACH ROW EXECUTE FUNCTION prevent_material_risk_mutation();

DROP TRIGGER IF EXISTS trg_material_risk_weight_sets_immutable ON material_risk_weight_sets;
CREATE TRIGGER trg_material_risk_weight_sets_immutable
    BEFORE UPDATE OR DELETE ON material_risk_weight_sets
    FOR EACH ROW EXECUTE FUNCTION prevent_material_risk_mutation();
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
            await session.execute(text(FORECAST_RUN_IMMUTABILITY_SQL))
            await session.commit()
            logger.info("Successfully applied forecast_runs immutability trigger")
            await session.execute(text(MATERIAL_RISK_IMMUTABILITY_SQL))
            await session.commit()
            logger.info("Successfully applied material risk immutability triggers")
        except Exception as e:
            logger.warning(f"Could not apply PostgreSQL trigger: {e}")
            await session.rollback()
