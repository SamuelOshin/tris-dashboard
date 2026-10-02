"""
Ticket 8 — Scenarios.

A scenario recalculates exposure from the stored forecast but must never change it. The
central test snapshots every stored forecast row byte-for-byte, runs scenarios (valid, extreme
and rejected), and compares. Further tests check the scenario arithmetic by hand, the labelling,
and that no scenario request writes anything to the database.

Fixed data: MAT-A, usage 50 kg a month (SUP-1 60%, SUP-2 40%), baseline price 100, stored
30-day forecast 110.
"""

import hashlib
import inspect
import json

import pytest
from httpx import AsyncClient
from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.modules.v1.manufacturing.service import exposure_engine, exposure_service
from app.api.modules.v1.manufacturing.service.exposure_types import DAYS_PER_MONTH
from tests.conftest import make_principal
from tests.modules.v1.exposure_seed import (
    AS_OF_Q,
    EXPOSURE,
    FORECASTS,
    ensure_supplier,
    seed_inventory,
    seed_lead_time,
    seed_material,
    store_run,
)

SCENARIO = f"{EXPOSURE}/scenario"


def body(horizon=30, material=None, **scenario):
    return {"horizon_days": horizon, "material_id": material, "scenario": scenario}


async def run_scenario(client: AsyncClient, **scenario):
    res = await client.post(SCENARIO, params=AS_OF_Q, json=body(**scenario))
    assert res.status_code == 200, res.text
    return res.json()["data"]["materials"][0]["scenario"]


async def seed_standard(session: AsyncSession) -> None:
    await seed_material(session)
    await store_run(session, "MAT-A", 30, [110.0])
    await store_run(session, "MAT-A", 90, [104.0, 108.0, 112.0])


# ── Scenario arithmetic, checked by hand ─────────────────────────────────────


@pytest.mark.asyncio
async def test_price_and_demand_scenario_matches_a_hand_calculation(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)
    s = await run_scenario(async_client, price_change_pct=10, demand_change_pct=20)
    # unit 110 * 1.10 = 121; usage 50 * 1.20 = 60; spend 7260 against a baseline of 5000
    assert s["scenario_unit_cost"] == pytest.approx(121.0)
    assert s["scenario_usage"] == pytest.approx(60.0)
    assert s["scenario_spend"] == pytest.approx(7260.0)
    assert s["scenario_exposure"] == pytest.approx(2260.0)
    # split into causes: price (121-100)*60, volume 100*(60-50); they add up to the exposure
    assert s["price_effect"] == pytest.approx(1260.0) and s["volume_effect"] == pytest.approx(
        1000.0
    )
    assert s["price_effect"] + s["volume_effect"] == pytest.approx(s["scenario_exposure"])
    assert s["change_vs_baseline"] == pytest.approx(2260.0 - 500.0)  # versus the stored baseline


@pytest.mark.asyncio
async def test_a_scenario_with_no_changes_reproduces_the_baseline(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)
    s = await run_scenario(async_client)
    assert s["scenario_exposure"] == pytest.approx(500.0) and s["change_vs_baseline"] == 0


@pytest.mark.asyncio
async def test_supplier_scenario_applies_only_to_that_suppliers_share(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)
    s = await run_scenario(async_client, supplier_id="SUP-1", supplier_price_change_pct=20)
    # SUP-1 supplies 60% of usage: 110 * (1 + 0.6 * 0.20) = 123.2
    assert s["scenario_unit_cost"] == pytest.approx(123.2)
    assert s["scenario_exposure"] == pytest.approx((123.2 - 100) * 50)
    other = await run_scenario(async_client, supplier_id="SUP-2", supplier_price_change_pct=20)
    assert other["scenario_unit_cost"] == pytest.approx(110 * (1 + 0.4 * 0.20))


@pytest.mark.asyncio
async def test_horizon_90_scenario_uses_the_stored_path_average(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)
    res = await async_client.post(SCENARIO, params=AS_OF_Q, json=body(90, price_change_pct=5))
    s = res.json()["data"]["materials"][0]["scenario"]
    assert s["scenario_unit_cost"] == pytest.approx(108 * 1.05)
    assert s["scenario_exposure"] == pytest.approx((108 * 1.05 - 100) * 150)


@pytest.mark.asyncio
async def test_lead_time_delay_and_inventory_change_drive_supply_cover_and_the_premium(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)
    await seed_inventory(db_session, "MAT-A", 100.0)
    await seed_lead_time(db_session, "SUP-1", 20.0)
    await seed_lead_time(db_session, "SUP-2", 40.0)  # lead time 28 days
    daily = 50 / DAYS_PER_MONTH
    s = await run_scenario(async_client, lead_time_delay_days=45, spot_premium_pct=10)
    assert s["supply_cover"]["lead_time_days"] == pytest.approx(73.0)
    uncovered_days = 73.0 - 100 / daily
    assert s["supply_cover"]["uncovered_days"] == pytest.approx(uncovered_days, abs=1e-3)
    assert s["premium_cost"] == pytest.approx(uncovered_days * daily * 110 * 0.10, abs=1e-2)
    assert s["scenario_exposure"] == pytest.approx(500 + s["premium_cost"])
    # without a premium the delay shows up as cover figures only: it adds no money by itself
    free = await run_scenario(async_client, lead_time_delay_days=45)
    assert free["premium_cost"] == 0 and free["scenario_exposure"] == pytest.approx(500)
    # less stock lengthens the shortfall, more stock removes it
    less = await run_scenario(async_client, lead_time_delay_days=45, inventory_change_pct=-50)
    more = await run_scenario(async_client, lead_time_delay_days=45, inventory_change_pct=100)
    assert less["supply_cover"]["uncovered_days"] > s["supply_cover"]["uncovered_days"]
    assert more["supply_cover"]["uncovered_days"] == 0


@pytest.mark.asyncio
async def test_premium_applies_only_to_the_shortfall_the_scenario_adds(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)
    await seed_inventory(db_session, "MAT-A", 10.0)  # already short: cover 6 days vs lead 28
    await seed_lead_time(db_session, "SUP-1", 28.0)
    await seed_lead_time(db_session, "SUP-2", 28.0)
    daily = 50 / DAYS_PER_MONTH
    already_short = 28 - 10 / daily
    assert already_short > 0
    none = await run_scenario(async_client, spot_premium_pct=50)  # nothing added: no premium
    assert none["premium_cost"] == 0
    s = await run_scenario(async_client, lead_time_delay_days=10, spot_premium_pct=50)
    assert s["premium_cost"] == pytest.approx(
        10 * daily * 110 * 0.5, abs=1e-2
    )  # only the 10 added days


@pytest.mark.asyncio
async def test_missing_stock_or_lead_time_is_reported_not_assumed(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)  # no stock snapshot, no lead time
    s = await run_scenario(async_client, lead_time_delay_days=30, spot_premium_pct=25)
    assert s["premium_cost"] == 0 and s["supply_cover"]["evaluable"] is False
    assert any("could not be evaluated" in n for n in s["notes"])


# ── Labelling ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_scenario_output_is_labelled_a_scenario_and_never_a_prediction(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)
    scenario = (
        await async_client.post(SCENARIO, params=AS_OF_Q, json=body(price_change_pct=10))
    ).json()
    data = scenario["data"]
    assert data["kind"] == "scenario"
    assert "not a prediction" in data["label"] and "Nothing here is saved" in data["label"]
    assert data["scenario"]["price_change_pct"] == 10  # the inputs are echoed back
    baseline = (await async_client.get(EXPOSURE, params=AS_OF_Q)).json()["data"]
    assert baseline["kind"] == "baseline" and baseline["scenario"] is None
    assert "scenario" not in baseline["materials"][0]
    # the roll-ups carry scenario columns only when a scenario was asked for
    assert "scenario_exposure" in data["rollups"]["category"][0]["total"]
    assert "scenario_exposure" not in baseline["rollups"]["category"][0]["total"]


@pytest.mark.asyncio
async def test_scenario_rollups_add_back_to_the_material_scenario_totals(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session, "MAT-A")
    await seed_material(db_session, "MAT-B", suppliers=(("SUP-2", 40.0),), category="Resins")
    await store_run(db_session, "MAT-A", 30, [110.0])
    await store_run(db_session, "MAT-B", 30, [105.0])
    res = await async_client.post(SCENARIO, params=AS_OF_Q, json=body(price_change_pct=10))
    data = res.json()["data"]
    total = sum(m["scenario"]["scenario_exposure"] for m in data["materials"])
    for dim in ("supplier", "product", "category"):
        block = data["rollups"][dim][0]
        assert block["total"]["scenario_exposure"] == pytest.approx(total), dim
        assert sum(g["scenario_exposure"] for g in block["groups"]) == pytest.approx(total), dim


# ── Validation ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_invalid_scenarios_are_rejected_with_nothing_applied(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)
    for bad in (
        {"price_change_pct": -100},
        {"price_change_pct": 900},
        {"demand_change_pct": -101},
        {"lead_time_delay_days": -1},
        {"spot_premium_pct": -5},
        {"made_up_control": 5},
        {"price_change_pct": "ten"},
    ):
        res = await async_client.post(SCENARIO, params=AS_OF_Q, json=body(**bad))
        assert res.status_code == 422, bad
    assert (
        await async_client.post(SCENARIO, params=AS_OF_Q, json=body(horizon=45))
    ).status_code == 422
    unknown_supplier = body(supplier_id="SUP-NOPE", supplier_price_change_pct=10)
    res = await async_client.post(SCENARIO, params=AS_OF_Q, json=unknown_supplier)
    assert res.status_code == 422 and "no recent purchases" in res.json()["message"]
    assert (
        await async_client.post(SCENARIO, params=AS_OF_Q, json=body(material="NOPE"))
    ).status_code == 404


@pytest.mark.asyncio
async def test_read_only_reviewers_can_explore_scenarios_but_other_roles_cannot(
    client_as, db_session: AsyncSession
):
    await seed_standard(db_session)
    for role, expected in (("read_only_reviewer", 200), ("reviewer", 200), ("process_owner", 403)):
        who = make_principal("USR-ADMIN-001", f"s_{role}", role, role)
        async with client_as(who) as client:
            res = await client.post(SCENARIO, params=AS_OF_Q, json=body(price_change_pct=5))
            assert res.status_code == expected, role


# ── The baseline is never changed ────────────────────────────────────────────

SNAPSHOT_SQL = text(
    "SELECT row_to_json(f)::text FROM (SELECT * FROM forecast_runs ORDER BY run_id) f"
)


async def snapshot(session: AsyncSession) -> str:
    """Every stored forecast row, as text, in a fixed order."""
    await session.rollback()  # end any open read transaction so the view is current
    rows = (await session.execute(SNAPSHOT_SQL)).scalars().all()
    return "\n".join(rows)


def stable(payload: dict) -> str:
    payload = json.loads(json.dumps(payload))
    payload["data"].pop("computed_at", None)
    return json.dumps(payload, sort_keys=True)


@pytest.mark.asyncio
async def test_scenario_does_not_mutate_baseline_forecast(
    async_client: AsyncClient, db_session: AsyncSession
):
    """The stored forecast record is byte-for-byte unchanged after running scenarios."""
    await seed_standard(db_session)
    before_rows = await snapshot(db_session)
    before_hash = hashlib.sha256(before_rows.encode()).hexdigest()
    forecast_before = stable(
        (await async_client.get(f"{FORECASTS}/materials/MAT-A", params=AS_OF_Q)).json()
    )
    exposure_before = stable((await async_client.get(EXPOSURE, params=AS_OF_Q)).json())
    assert before_rows.count("\n") == 1  # two stored runs (30 and 90 days)

    scenarios = [
        {"price_change_pct": 25, "demand_change_pct": -30},
        {"price_change_pct": 500, "demand_change_pct": 500},
        {"price_change_pct": -90, "demand_change_pct": -100},
        {"supplier_id": "SUP-1", "supplier_price_change_pct": 80},
        {"lead_time_delay_days": 120, "inventory_change_pct": -100, "spot_premium_pct": 300},
    ]
    for horizon in (30, 90):
        for scenario in scenarios:
            res = await async_client.post(SCENARIO, params=AS_OF_Q, json=body(horizon, **scenario))
            assert res.status_code == 200
    await async_client.post(SCENARIO, params=AS_OF_Q, json=body(price_change_pct=-100))  # rejected

    after_rows = await snapshot(db_session)
    assert after_rows == before_rows  # same rows, same values, same order
    assert hashlib.sha256(after_rows.encode()).hexdigest() == before_hash
    forecast_after = stable(
        (await async_client.get(f"{FORECASTS}/materials/MAT-A", params=AS_OF_Q)).json()
    )
    assert forecast_after == forecast_before  # the forecast API shows the same prediction
    assert stable((await async_client.get(EXPOSURE, params=AS_OF_Q)).json()) == exposure_before


@pytest.mark.asyncio
async def test_a_scenario_request_issues_no_writes_to_the_database(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)
    statements: list[str] = []

    def record(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement.lstrip().split(None, 1)[0].upper())

    event.listen(Engine, "before_cursor_execute", record)
    try:
        res = await async_client.post(SCENARIO, params=AS_OF_Q, json=body(price_change_pct=15))
    finally:
        event.remove(Engine, "before_cursor_execute", record)
    assert res.status_code == 200
    assert statements, "the request should have read from the database"

    # Control: the same listener does see a write when one happens, so silence means no writes.
    control: list[str] = []

    def record_control(conn, cursor, statement, parameters, context, executemany):
        control.append(statement.lstrip().split(None, 1)[0].upper())

    event.listen(Engine, "before_cursor_execute", record_control)
    try:
        await ensure_supplier(db_session, "SUP-CONTROL")
    finally:
        event.remove(Engine, "before_cursor_execute", record_control)
    assert "INSERT" in control
    writes = {s for s in statements if s not in {"SELECT", "BEGIN", "ROLLBACK", "SET", "SHOW"}}
    assert not writes, f"unexpected statements: {sorted(writes)}"


def test_the_scenario_code_has_no_way_to_write():
    """Static guard: the calculation is pure and the service only reads."""
    engine_src = inspect.getsource(exposure_engine)
    assert "sqlalchemy" not in engine_src and "session" not in engine_src.lower()
    service_src = inspect.getsource(exposure_service)
    for forbidden in (
        ".add(",
        ".commit(",
        ".flush(",
        ".delete(",
        "insert(",
        "update(",
        "ForecastRun(",
    ):
        assert forbidden not in service_src, forbidden


@pytest.mark.asyncio
async def test_the_rush_buy_premium_is_capped_at_the_usage_of_the_horizon(
    async_client: AsyncClient, db_session: AsyncSession
):
    """A very long delay cannot make the shortfall larger than the units used in the horizon."""
    await seed_standard(db_session)
    await seed_inventory(db_session, "MAT-A", 1.0)  # almost no stock
    await seed_lead_time(db_session, "SUP-1", 28.0)
    await seed_lead_time(db_session, "SUP-2", 28.0)
    s = await run_scenario(async_client, lead_time_delay_days=365, spot_premium_pct=50)
    assert s["supply_cover"]["uncovered_quantity"] > 50  # the raw shortfall is far beyond usage
    assert s["premium_cost"] == pytest.approx(50 * 110 * 0.5, abs=1e-2)  # but only 50 units pay
    assert s["scenario_exposure"] == pytest.approx(500 + 2750, abs=1e-2)
