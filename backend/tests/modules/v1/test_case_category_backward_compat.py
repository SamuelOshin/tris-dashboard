"""
Ticket 4 — RiskCase.case_category backward compatibility (D3).

Proves, against real PostgreSQL, that:
1. Pre-existing case rows survive the migration and are backfilled to
   'financial_exception' (round-trips the real Alembic migration on a scratch database).
2. New cases default to 'financial_exception' with the material fields NULL.
3. The category is constrained to the two permitted values.
4. A 'material_cost_risk' case can reference a material and carries its three new fields.
5. The existing case API and the unchanged state machine behave as before.
"""

import os
import subprocess
import sys
from pathlib import Path

import psycopg
import pytest
from httpx import AsyncClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from app.api.modules.v1.cases.models.risk_case import RiskCase
from app.api.modules.v1.manufacturing.models import Material
from tests.conftest import TEST_DATABASE_URL, _admin_conninfo

pytestmark = pytest.mark.db  # also reaches PostgreSQL through its own scratch database

BACKEND_DIR = Path(__file__).resolve().parents[3]
PREVIOUS_REVISION = "cbbdff801f48"
LATER_TABLES = {
    "mapping_profiles",
    "forecast_runs",
    "material_risk_scores",
    "material_risk_weight_sets",
    "validation_runs",
    "validation_cases",
    "validation_outcomes",
    "validation_summaries",
    "validation_failures",
}  # added by Tickets 5 and 7
NEW_TABLES = {
    "materials",
    "material_suppliers",
    "material_costs",
    "purchase_records",
    "inventory_records",
    "variance_inputs",
    "bom_entries",
    "production_records",
    "demand_forecasts",
    "supplier_operations_metrics",
    "financial_plan_records",
}
NEW_CASE_COLUMNS = {
    "case_category",
    "material_id",
    "forecast_horizon",
    "projected_exposure_amount",
}


LIST_TABLES_SQL = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
LIST_CASE_COLUMNS_SQL = (
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'risk_cases'"
)
LEGACY_ROW_SQL = (
    "SELECT case_category, material_id, forecast_horizon, projected_exposure_amount, "
    "status, priority FROM risk_cases WHERE case_id = 'CASE-LEGACY-1'"
)


def _case(case_id: str, **overrides) -> RiskCase:
    return RiskCase(
        case_id=case_id,
        case_number=f"{case_id}-N",
        priority="High",
        status="Under Investigation",
        trigger_signals=[],
        evaluation_snapshot={},
        **overrides,
    )


# ── 1. Real migration round trip on a scratch database ───────────────────────


def _alembic(db_url: str, *args: str) -> None:
    env = {**os.environ, "DATABASE_URL": db_url}
    result = subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert result.returncode == 0, f"alembic {' '.join(args)} failed:\n{result.stderr[-2000:]}"


def test_migration_backfills_existing_cases_and_round_trips():
    """
    Pre-existing case rows must survive the Ticket 4 migration unchanged and be
    backfilled to 'financial_exception'; downgrade must remove only the additions.
    """
    scratch = "tris_migration_check_test"
    assert "test" in scratch  # same safety rule as the main test database
    scratch_url = TEST_DATABASE_URL.rsplit("/", 1)[0] + f"/{scratch}"

    with psycopg.connect(_admin_conninfo(), autocommit=True) as admin:
        admin.execute(f'DROP DATABASE IF EXISTS "{scratch}" WITH (FORCE)')
        admin.execute(f'CREATE DATABASE "{scratch}"')

    engine = create_engine(scratch_url)
    try:
        # Build the full current schema, then step back to the pre-Ticket-4 revision so the
        # database genuinely looks like v1.4 with a legacy case row in it.
        SQLModel.metadata.create_all(engine)
        # Stamp at the current head so the downgrade walks the real chain (later migrations
        # that reference these tables, such as forecast_runs, are removed first).
        _alembic(scratch_url, "stamp", "head")
        _alembic(scratch_url, "downgrade", PREVIOUS_REVISION)

        with engine.begin() as conn:
            tables = {r[0] for r in conn.execute(text(LIST_TABLES_SQL))}
            columns = {r[0] for r in conn.execute(text(LIST_CASE_COLUMNS_SQL))}
            assert not (NEW_TABLES & tables), "downgrade must drop the manufacturing tables"
            assert not (LATER_TABLES & tables), "downgrade must also drop later migrations' tables"
            assert not (NEW_CASE_COLUMNS & columns), "downgrade must drop the new case columns"

            conn.execute(
                text(
                    "INSERT INTO risk_cases (case_id, case_number, priority, status, "
                    "trigger_signals, evaluation_snapshot, created_at, updated_at) "
                    "VALUES ('CASE-LEGACY-1', 'CN-LEGACY-1', 'High', 'Under Investigation', "
                    "'[]', '{}', NOW(), NOW())"
                )
            )

        _alembic(scratch_url, "upgrade", "head")

        with engine.begin() as conn:
            row = conn.execute(text(LEGACY_ROW_SQL)).one()
            assert row.case_category == "financial_exception"
            assert row.material_id is None
            assert row.forecast_horizon is None
            assert row.projected_exposure_amount is None
            assert (row.status, row.priority) == ("Under Investigation", "High")

            tables = {r[0] for r in conn.execute(text(LIST_TABLES_SQL))}
            assert NEW_TABLES <= tables

        # The migration and the models must agree: no pending autogenerate differences.
        _alembic(scratch_url, "check")
    finally:
        engine.dispose()
        with psycopg.connect(_admin_conninfo(), autocommit=True) as admin:
            admin.execute(f'DROP DATABASE IF EXISTS "{scratch}" WITH (FORCE)')


# ── 2-4. ORM / constraint behaviour on the main test database ────────────────


@pytest.mark.asyncio
async def test_new_case_defaults_to_financial_exception(db_session: AsyncSession):
    db_session.add(_case("CASE-DEFAULT-1"))
    await db_session.commit()

    case = await db_session.get(RiskCase, "CASE-DEFAULT-1")
    assert case.case_category == "financial_exception"
    assert case.material_id is None
    assert case.forecast_horizon is None
    assert case.projected_exposure_amount is None


@pytest.mark.asyncio
async def test_raw_insert_without_category_gets_database_default(db_session: AsyncSession):
    """A writer that knows nothing about the new column still gets the safe default."""
    await db_session.execute(
        text(
            "INSERT INTO risk_cases (case_id, case_number, priority, status, "
            "trigger_signals, evaluation_snapshot, created_at, updated_at) "
            "VALUES ('CASE-RAW-1', 'CN-RAW-1', 'Low', 'New', '[]', '{}', NOW(), NOW())"
        )
    )
    await db_session.commit()
    result = await db_session.execute(
        text("SELECT case_category FROM risk_cases WHERE case_id='CASE-RAW-1'")
    )
    assert result.scalar_one() == "financial_exception"


@pytest.mark.asyncio
async def test_invalid_case_category_rejected(db_session: AsyncSession):
    db_session.add(_case("CASE-BAD-1", case_category="something_else"))
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_material_cost_risk_case_links_to_material(db_session: AsyncSession):
    db_session.add(Material(material_id="MAT-001", description="Steel coil", unit_of_measure="kg"))
    await db_session.commit()
    db_session.add(
        _case(
            "CASE-MAT-1",
            case_category="material_cost_risk",
            material_id="MAT-001",
            forecast_horizon=90,
            projected_exposure_amount=125000.5,
        )
    )
    await db_session.commit()

    case = await db_session.get(RiskCase, "CASE-MAT-1")
    assert case.case_category == "material_cost_risk"
    assert case.material_id == "MAT-001"
    assert case.forecast_horizon == 90
    assert case.projected_exposure_amount == 125000.5


@pytest.mark.asyncio
async def test_case_cannot_reference_unknown_material(db_session: AsyncSession):
    db_session.add(_case("CASE-MAT-2", case_category="material_cost_risk", material_id="NOPE"))
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


# ── 5. Existing behaviour unchanged ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_existing_case_api_and_state_machine_unchanged(
    async_client: AsyncClient, db_session: AsyncSession
):
    db_session.add(_case("CASE-API-1"))
    await db_session.commit()

    res_list = await async_client.get("/api/v1/cases")
    assert res_list.status_code == 200
    assert any(c["case_id"] == "CASE-API-1" for c in res_list.json()["data"])

    res_detail = await async_client.get("/api/v1/cases/CASE-API-1")
    assert res_detail.status_code == 200
    assert res_detail.json()["data"]["status"] == "Under Investigation"

    # An invalid jump is still rejected exactly as before (no category-specific branching).
    res_bad = await async_client.post(
        "/api/v1/cases/CASE-API-1/transition", json={"to_status": "Closed"}
    )
    assert res_bad.status_code >= 400
