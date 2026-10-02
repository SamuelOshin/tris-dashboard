"""
Ticket 8 — Financial exposure.

    baseline_spend     = baseline_unit_cost * expected_usage
    forecast_spend     = forecast_unit_cost * expected_usage
    projected_exposure = forecast_spend - baseline_spend

Figures are checked against hand calculations on a small fixed dataset: MAT-A is bought every
month at 100 (30 kg from SUP-1, 20 kg from SUP-2), so monthly usage is 50 kg. Forecasts are stored
with chosen values, so the expected numbers are exact.
"""

from datetime import UTC, date, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.modules.v1.manufacturing.models import ForecastRun, PurchaseRecord
from app.api.modules.v1.manufacturing.service import exposure_engine as engine
from app.api.modules.v1.manufacturing.service.analytics_types import PurchaseRow
from app.api.modules.v1.manufacturing.service.exposure_types import (
    DEFAULT_EXPOSURE_CONFIG,
    ExposureInput,
    StoredForecast,
)
from tests.conftest import make_principal
from tests.modules.v1.exposure_seed import (
    AS_OF,
    AS_OF_Q,
    EXPOSURE,
    seed_bom,
    seed_inventory,
    seed_lead_time,
    seed_material,
    seed_production,
    store_run,
)


def forecast(path, last=100.0) -> StoredForecast:
    return StoredForecast(
        run_id="R1",
        model_name="Naive",
        model_version="1.0",
        as_of=AS_OF,
        horizon_days=30 * len(path),
        horizon_months=len(path),
        currency="USD",
        last_observed_price=last,
        path_values=tuple(path),
        end_value=path[-1],
        history_end=date(2026, 4, 1),
        created_at="2026-04-30T00:00:00+00:00",
    )


def exposure_input(path=(110.0,), usage=50.0, **kw) -> ExposureInput:
    return ExposureInput(
        material_id="M",
        description="M",
        category="Metals",
        unit_of_measure="kg",
        forecast=forecast(list(path)),
        monthly_usage=usage,
        usage_months=6,
        **kw,
    )


# ── The formula, with no database ────────────────────────────────────────────


def test_exposure_formula_is_forecast_spend_minus_baseline_spend():
    row = engine.baseline_exposure(exposure_input(path=(110.0,), usage=50.0))
    assert row["expected_usage"] == 50.0  # one month of usage for a 30-day horizon
    assert row["baseline_spend"] == pytest.approx(100.0 * 50)
    assert row["forecast_spend"] == pytest.approx(110.0 * 50)
    assert row["projected_exposure"] == pytest.approx(row["forecast_spend"] - row["baseline_spend"])
    assert row["projected_exposure"] == pytest.approx(500.0)
    assert row["exposure_pct"] == pytest.approx(10.0)


def test_a_three_month_horizon_prices_each_month_at_its_own_forecast():
    row = engine.baseline_exposure(exposure_input(path=(104.0, 108.0, 112.0), usage=50.0))
    assert row["expected_usage"] == pytest.approx(150.0)  # 3 months of usage
    assert row["forecast_unit_cost"] == pytest.approx(108.0)  # average of the three monthly values
    assert row["forecast_end_unit_cost"] == 112.0  # shown for reference, not used for the sum
    assert row["projected_exposure"] == pytest.approx((104 + 108 + 112 - 300) * 50)  # 1200


def test_a_falling_forecast_gives_negative_exposure_not_zero():
    row = engine.baseline_exposure(exposure_input(path=(90.0,), usage=50.0))
    assert row["projected_exposure"] == pytest.approx(-500.0)


def test_zero_baseline_spend_has_no_percentage():
    row = engine.baseline_exposure(exposure_input(path=(5.0,), usage=0.0))
    assert row["projected_exposure"] == 0 and row["exposure_pct"] is None


def _lines(spec):
    """spec: (year, month, supplier, quantity)."""
    return [PurchaseRow(date(y, m, 5), q, 10.0, s, None, "USD") for y, m, s, q in spec]


def test_usage_counts_empty_months_as_zero_and_ignores_months_before_the_first_purchase():
    window = engine.usage_window(date(2026, 4, 1), date(2025, 1, 1), DEFAULT_EXPOSURE_CONFIG)
    assert window[0] == date(2025, 11, 1) and window[-1] == date(2026, 4, 1) and len(window) == 6
    # 60 kg bought in two of the six months: 10 kg a month, not 30
    usage, shares = engine.usage_and_supplier_shares(
        _lines([(2025, 12, "A", 20), (2026, 2, "A", 20), (2026, 3, "B", 20)]), "USD", window
    )
    assert usage == pytest.approx(10.0)
    assert shares == {"A": pytest.approx(2 / 3), "B": pytest.approx(1 / 3)}
    short = engine.usage_window(date(2026, 4, 1), date(2026, 2, 1), DEFAULT_EXPOSURE_CONFIG)
    assert len(short) == 3  # only the months since the first purchase
    usage, _ = engine.usage_and_supplier_shares(_lines([(2026, 3, "A", 30)]), "USD", short)
    assert usage == pytest.approx(10.0)


def test_other_currencies_and_months_outside_the_window_are_not_usage():
    window = engine.usage_window(date(2026, 4, 1), date(2025, 1, 1), DEFAULT_EXPOSURE_CONFIG)
    rows = _lines([(2026, 4, "A", 12), (2025, 6, "A", 999)])
    rows.append(PurchaseRow(date(2026, 4, 9), 500.0, 9.0, "A", None, "EUR"))
    usage, _ = engine.usage_and_supplier_shares(rows, "USD", window)
    assert usage == pytest.approx(12 / 6)


# ── Through the API, from stored forecasts ───────────────────────────────────


@pytest.mark.asyncio
async def test_exposure_comes_from_the_stored_forecast_with_hand_checked_numbers(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session)
    await store_run(db_session, "MAT-A", 30, [110.0])
    await store_run(db_session, "MAT-A", 90, [104.0, 108.0, 112.0])
    for days, usage, base, fcst in ((30, 50, 5000, 5500), (90, 150, 15000, 16200)):
        res = await async_client.get(EXPOSURE, params={"horizon_days": days, **AS_OF_Q})
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["kind"] == "baseline" and data["method_version"] == "1.0"
        row = data["materials"][0]
        assert row["expected_usage"] == usage and row["baseline_spend"] == base
        assert row["forecast_spend"] == fcst and row["projected_exposure"] == fcst - base
        assert row["usage_basis"] == {
            "method": "trailing_purchases",
            "monthly_usage": 50.0,
            "months_used": 6,
        }
        assert row["forecast"]["run_id"].startswith("FRC-MAT-A-")
        assert "scenario" not in row


@pytest.mark.asyncio
async def test_the_newest_stored_run_is_used_and_values_are_not_recomputed(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session)
    # 999 is a value no model would produce from this flat history: it must be used as stored.
    await store_run(db_session, "MAT-A", 30, [150.0], created_at=datetime(2026, 5, 1, tzinfo=UTC))
    await store_run(db_session, "MAT-A", 30, [999.0], created_at=datetime(2026, 5, 2, tzinfo=UTC))
    row = (await async_client.get(EXPOSURE, params=AS_OF_Q)).json()["data"]["materials"][0]
    assert row["forecast_unit_cost"] == 999.0 and row["projected_exposure"] == (999 - 100) * 50


async def _run_count(session: AsyncSession) -> int:
    return (await session.execute(select(func.count()).select_from(ForecastRun))).scalar_one()


@pytest.mark.asyncio
async def test_no_stored_forecast_means_not_available_and_nothing_is_stored(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session, "MAT-A")
    await seed_material(db_session, "MAT-S", months=6)  # too short for a 90-day forecast
    await store_run(db_session, "MAT-A", 30, [110.0])
    runs_before = await _run_count(db_session)

    res = await async_client.get(EXPOSURE, params={**AS_OF_Q, "horizon_days": 90})
    data = res.json()["data"]
    assert data["materials"] == []
    reasons = {m["material_id"]: m["reason"] for m in data["not_available"]}
    assert "Run it first" in reasons["MAT-A"]  # 16 months is enough, but no 90-day run is stored
    assert "needs 15 consecutive months" in reasons["MAT-S"]
    assert "6 are available" in reasons["MAT-S"]
    assert await _run_count(db_session) == runs_before  # exposure never runs or stores a forecast
    assert data["rollups"]["supplier"] == []


@pytest.mark.asyncio
async def test_purchases_after_the_as_of_date_do_not_change_exposure(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session)
    await store_run(db_session, "MAT-A", 30, [110.0])
    before = (await async_client.get(EXPOSURE, params=AS_OF_Q)).json()["data"]["materials"][0]
    db_session.add(
        PurchaseRecord(
            material_id="MAT-A",
            supplier_id="SUP-1",
            purchase_date=date(2026, 5, 20),
            quantity=9000,
            unit_price=500.0,
        )
    )
    await db_session.commit()
    after = (await async_client.get(EXPOSURE, params=AS_OF_Q)).json()["data"]["materials"][0]
    assert after == before


@pytest.mark.asyncio
async def test_changed_purchase_data_is_flagged_but_the_stored_baseline_is_kept(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session)
    await store_run(db_session, "MAT-A", 30, [110.0], last_price=95.0)  # data says 100 now
    row = (await async_client.get(EXPOSURE, params=AS_OF_Q)).json()["data"]["materials"][0]
    assert "has changed since this forecast was stored" in row["stale_note"]
    assert row["baseline_unit_cost"] == 95.0  # the stored baseline is what is reported


# ── Roll-ups ─────────────────────────────────────────────────────────────────


def _group(rollup, currency, key):
    block = next(b for b in rollup if b["currency"] == currency)
    return next(g for g in block["groups"] if g["key"] == key)


@pytest.mark.asyncio
async def test_rollups_by_supplier_product_and_category_add_back_to_the_material_totals(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session, "MAT-A")  # SUP-1 60%, SUP-2 40%; category Metals
    await seed_material(db_session, "MAT-B", suppliers=(("SUP-2", 40.0),), category="Resins")
    await store_run(db_session, "MAT-A", 30, [110.0])  # exposure 500
    await store_run(db_session, "MAT-B", 30, [105.0])  # usage 40 -> exposure 200
    # Products using MAT-A: P1 weight 2*100, P2 weight 1*100 -> 2/3 and 1/3
    await seed_bom(db_session, "P1", "MAT-A", 2.0)
    await seed_bom(db_session, "P2", "MAT-A", 1.0)
    await seed_production(db_session, "P1", 100)
    await seed_production(db_session, "P2", 100)

    data = (await async_client.get(EXPOSURE, params=AS_OF_Q)).json()["data"]
    total = sum(m["projected_exposure"] for m in data["materials"])
    assert total == pytest.approx(700.0)
    for dim in ("supplier", "product", "category"):
        block = data["rollups"][dim][0]
        assert block["currency"] == "USD"
        assert block["total"]["projected_exposure"] == pytest.approx(total), dim
        assert sum(g["projected_exposure"] for g in block["groups"]) == pytest.approx(total), dim

    supplier = data["rollups"]["supplier"]
    assert _group(supplier, "USD", "SUP-1")["projected_exposure"] == pytest.approx(500 * 0.6)
    assert _group(supplier, "USD", "SUP-2")["projected_exposure"] == pytest.approx(500 * 0.4 + 200)
    product = data["rollups"]["product"]
    assert _group(product, "USD", "P1")["projected_exposure"] == pytest.approx(500 * 2 / 3)
    assert _group(product, "USD", "P2")["projected_exposure"] == pytest.approx(500 / 3)
    # MAT-B is in no product with production volume
    assert _group(product, "USD", "Unallocated")["projected_exposure"] == pytest.approx(200)
    category = data["rollups"]["category"]
    assert _group(category, "USD", "Metals")["projected_exposure"] == pytest.approx(500)
    assert _group(category, "USD", "Resins")["projected_exposure"] == pytest.approx(200)


@pytest.mark.asyncio
async def test_without_production_volume_exposure_is_unallocated_never_guessed(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session)
    await store_run(db_session, "MAT-A", 30, [110.0])
    await seed_bom(db_session, "P1", "MAT-A", 2.0)  # a BOM line, but no production volume
    res = await async_client.get(EXPOSURE, params=AS_OF_Q)
    product = res.json()["data"]["rollups"]["product"]
    assert [g["key"] for g in product[0]["groups"]] == ["Unallocated"]


@pytest.mark.asyncio
async def test_currencies_are_never_added_together(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session, "MAT-A")
    await seed_material(db_session, "MAT-E", currency="EUR", suppliers=(("SUP-1", 50.0),))
    await store_run(db_session, "MAT-A", 30, [110.0])
    await store_run(db_session, "MAT-E", 30, [120.0], currency="EUR")
    data = (await async_client.get(EXPOSURE, params=AS_OF_Q)).json()["data"]
    blocks = {b["currency"]: b for b in data["rollups"]["category"]}
    assert set(blocks) == {"USD", "EUR"}
    assert blocks["USD"]["total"]["projected_exposure"] == pytest.approx(500)
    assert blocks["EUR"]["total"]["projected_exposure"] == pytest.approx(1000)


# ── Supply cover (inputs to the scenario controls) ───────────────────────────


@pytest.mark.asyncio
async def test_supply_cover_uses_the_latest_stock_and_share_weighted_lead_time(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session)
    await store_run(db_session, "MAT-A", 30, [110.0])
    await seed_inventory(db_session, "MAT-A", 100.0)
    await seed_lead_time(db_session, "SUP-1", 20.0)  # share 0.6
    await seed_lead_time(db_session, "SUP-2", 40.0)  # share 0.4
    row = (await async_client.get(EXPOSURE, params=AS_OF_Q)).json()["data"]["materials"][0]
    cover = row["supply_cover"]
    assert cover["evaluable"] is True
    assert cover["lead_time_days"] == pytest.approx(0.6 * 20 + 0.4 * 40)  # 28
    assert cover["cover_days"] == pytest.approx(100 / (50 / (365 / 12)), abs=1e-3)  # 60.8 days
    assert cover["uncovered_days"] == 0


@pytest.mark.asyncio
async def test_missing_stock_or_lead_time_is_not_evaluable_rather_than_assumed(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session)
    await store_run(db_session, "MAT-A", 30, [110.0])
    row = (await async_client.get(EXPOSURE, params=AS_OF_Q)).json()["data"]["materials"][0]
    assert row["supply_cover"]["evaluable"] is False and row["supply_cover"]["cover_days"] is None


# ── Inputs, roles and empty states ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_bad_inputs_and_empty_states(async_client: AsyncClient, db_session: AsyncSession):
    empty = (await async_client.get(EXPOSURE)).json()["data"]
    assert empty["has_data"] is False
    await seed_material(db_session)
    assert (await async_client.get(EXPOSURE, params={"horizon_days": 45})).status_code == 422
    unknown = await async_client.get(EXPOSURE, params={**AS_OF_Q, "material_id": "NOPE"})
    assert unknown.status_code == 404


@pytest.mark.asyncio
async def test_exposure_is_visible_to_manufacturing_roles_only(client_as, db_session: AsyncSession):
    await seed_material(db_session)
    await store_run(db_session, "MAT-A", 30, [110.0])
    for role, expected in (
        ("admin", 200),
        ("reviewer", 200),
        ("read_only_reviewer", 200),
        ("verifier", 403),
        ("process_owner", 403),
    ):
        who = make_principal("USR-ADMIN-001", f"x_{role}", role, role)
        async with client_as(who) as client:
            res = await client.get(EXPOSURE, params=AS_OF_Q)
            assert res.status_code == expected, role


def test_a_stored_run_with_an_empty_path_falls_back_to_its_end_value():
    inp = exposure_input(path=(110.0,))
    inp.forecast = forecast([110.0])
    object.__setattr__(inp.forecast, "path_values", ())
    row = engine.baseline_exposure(inp)
    assert row["forecast_unit_cost"] == 110.0 and row["projected_exposure"] == pytest.approx(500)


@pytest.mark.asyncio
async def test_product_shares_ignore_production_after_the_last_complete_month(
    async_client: AsyncClient, db_session: AsyncSession
):
    """As of 10 May, May is incomplete: usage excludes it, so product weights must too."""
    as_of = date(2026, 5, 10)
    await seed_material(db_session)  # purchases run to April
    await store_run(db_session, "MAT-A", 30, [110.0], as_of=as_of)
    await seed_bom(db_session, "P1", "MAT-A", 1.0)
    await seed_bom(db_session, "P2", "MAT-A", 1.0)
    await seed_production(db_session, "P1", 100)  # April: inside the window
    await seed_production(db_session, "P2", 9000, (date(2026, 5, 1), date(2026, 5, 9)))
    res = await async_client.get(EXPOSURE, params={"as_of": as_of.isoformat()})
    product = res.json()["data"]["rollups"]["product"]
    assert [g["key"] for g in product[0]["groups"]] == ["P1"]  # P2's May volume is not counted
    assert product[0]["groups"][0]["projected_exposure"] == pytest.approx(500)
