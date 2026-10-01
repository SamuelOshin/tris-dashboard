"""
Ticket 6 — Material-cost detection.

Part 1 tests every detector as a pure function (no database): it triggers, stays clear, and —
above all — reports `not_evaluable` rather than `clear` when the data it needs is missing.
Part 2 tests the stored-data path: genuine empty state, figures computed from rows (and
changing when the rows change), no use of data after the as-of date, filters and roles.
"""

from datetime import date
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.modules.v1.manufacturing.models import (
    BOMEntry,
    InventoryRecord,
    Material,
    MaterialCost,
    MaterialSupplier,
    PurchaseRecord,
    SupplierOperationsMetric,
    VarianceInput,
)
from app.api.modules.v1.manufacturing.service import detectors_exposure as exposure
from app.api.modules.v1.manufacturing.service import detectors_price as price
from app.api.modules.v1.manufacturing.service.analytics_service import SIGNAL_NAMES
from app.api.modules.v1.manufacturing.service.analytics_types import (
    CLEAR,
    DEFAULT_CONFIG,
    NOT_EVALUABLE,
    TRIGGERED,
    BomRow,
    CostRow,
    InventoryRow,
    MaterialData,
    OpsRow,
    PurchaseRow,
    VarianceRow,
)
from app.api.modules.v1.manufacturing.service.detection_engine import compute_results
from app.api.modules.v1.manufacturing.service.price_series import monthly_series
from app.api.modules.v1.suppliers.models.supplier import Supplier
from tests.conftest import make_principal

CFG = DEFAULT_CONFIG
AS_OF = date(2025, 12, 31)
BASE = "/api/v1/manufacturing/analytics"
REPO_ROOT = Path(__file__).resolve().parents[4]


def buy(year, month, unit_price, qty=100.0, supplier="S1", ref=None, day=15, currency="USD"):
    return PurchaseRow(date(year, month, day), qty, unit_price, supplier, ref, currency)


def series(prices, start_month=1, year=2025):
    return monthly_series([buy(year, start_month + i, p) for i, p in enumerate(prices)])


# ── Part 1: detectors ────────────────────────────────────────────────────────


def test_rapid_increase_triggers_clear_and_not_evaluable():
    assert price.rapid_price_increase(series([100, 111]), CFG).status == TRIGGERED
    assert price.rapid_price_increase(series([100, 109]), CFG).status == CLEAR
    assert (
        price.rapid_price_increase(series([100, 80]), CFG).status == CLEAR
    )  # a fall is not a risk
    one_month = price.rapid_price_increase(series([100]), CFG)
    assert one_month.status == NOT_EVALUABLE and "two different months" in one_month.explanation
    signal = price.rapid_price_increase(series([100, 111]), CFG)
    assert signal.value == 11.0 and "Jan 2025" in signal.explanation


def test_abnormal_price_uses_the_materials_own_history():
    noisy = [99, 101] * 4  # 8 months, mean 100, spread 1
    assert price.abnormal_price(series([*noisy, 120]), CFG).status == TRIGGERED
    assert price.abnormal_price(series([*noisy, 100.5]), CFG).status == CLEAR
    flat_jump = price.abnormal_price(series([100.0] * 8 + [110.0]), CFG)
    assert flat_jump.status == TRIGGERED and "far above" in flat_jump.explanation
    short = price.abnormal_price(series([100, 101, 102]), CFG)
    assert short.status == NOT_EVALUABLE and "earlier months" in short.explanation


def _std(version, start, end, cost):
    return CostRow(version, start, end, cost, "USD")


def test_standard_cost_deviation_needs_every_month_and_a_standard():
    data = MaterialData("M", "Mat", None, "kg", costs=[_std(1, date(2025, 1, 1), None, 100.0)])
    persistent = series([106, 107, 108], start_month=10)
    assert price.standard_cost_deviation(data, persistent, "USD", CFG).status == TRIGGERED
    one_low = series([106, 101, 108], start_month=10)
    assert price.standard_cost_deviation(data, one_low, "USD", CFG).status == CLEAR
    no_std = MaterialData("M", "Mat", None, "kg")
    missing = price.standard_cost_deviation(no_std, persistent, "USD", CFG)
    assert missing.status == NOT_EVALUABLE and "No standard cost" in missing.explanation
    assert price.standard_cost_deviation(data, series([106, 107]), "USD", CFG).status == (
        NOT_EVALUABLE
    )


def test_standard_cost_follows_the_version_in_force():
    costs = [
        _std(1, date(2025, 1, 1), date(2025, 9, 30), 100.0),
        _std(2, date(2025, 10, 1), None, 130.0),
    ]
    data = MaterialData("M", "Mat", None, "kg", costs=costs)
    prices = series([106, 107, 108], start_month=10)  # +6% over v1 but BELOW the new v2 standard
    assert price.standard_cost_deviation(data, prices, "USD", CFG).status == CLEAR


def test_ppv_trend_reported_derived_and_insufficient():
    def v(i, amount):
        return VarianceRow(date(2025, i, 1), date(2025, i, 28), None, None, None, amount)

    rising = MaterialData("M", "M", None, "kg", variances=[v(1, 10), v(2, 50), v(3, 90)])
    assert price.ppv_trend(rising, [], "USD", CFG).status == TRIGGERED
    flat = MaterialData("M", "M", None, "kg", variances=[v(1, 90), v(2, 50), v(3, 90)])
    assert price.ppv_trend(flat, [], "USD", CFG).status == CLEAR
    negative = MaterialData("M", "M", None, "kg", variances=[v(1, -9), v(2, -5), v(3, -1)])
    assert price.ppv_trend(negative, [], "USD", CFG).status == CLEAR  # improving, still underspend
    few = MaterialData("M", "M", None, "kg", variances=[v(1, 10)])
    assert price.ppv_trend(few, [], "USD", CFG).status == NOT_EVALUABLE

    derived = MaterialData("M", "M", None, "kg", costs=[_std(1, date(2025, 1, 1), None, 100.0)])
    pts = series([102, 105, 110])
    signal = price.ppv_trend(derived, pts, "USD", CFG)
    assert signal.status == TRIGGERED and signal.details["source"].startswith("derived")


def test_procurement_anomaly_flags_only_recent_outliers():
    history = [
        buy(2025, 1 + i % 6, 10.0 + (0.1 if i % 2 else -0.1), ref=f"H{i}") for i in range(10)
    ]
    odd = buy(2025, 12, 12.0, ref="ODD", day=10)
    normal = buy(2025, 12, 10.05, ref="OK", day=11)
    assert price.procurement_anomalies([*history, odd, normal], AS_OF, CFG).status == TRIGGERED
    clear = price.procurement_anomalies([*history, normal], AS_OF, CFG)
    assert clear.status == CLEAR
    thin = price.procurement_anomalies(history[:3] + [odd], AS_OF, CFG)
    assert thin.status == NOT_EVALUABLE
    hit = price.procurement_anomalies([*history, odd], AS_OF, CFG)
    assert hit.details["lines"][0]["reference"] == "ODD"


def _bom(sku, material, qty=1.0):
    return BomRow(sku, f"{sku} product", material, qty, "kg", None, None)


def test_bom_escalation_attributes_the_rise_to_the_right_material():
    a_up = {"A": series([10, 11, 12], start_month=10), "B": series([10, 10, 10], start_month=10)}
    bom = [_bom("P1", "A"), _bom("P1", "B")]
    hit = exposure.bom_cost_escalation("A", bom, a_up, AS_OF, CFG)
    assert hit.status == TRIGGERED and hit.details["products"][0]["material_share_of_rise"] == 1.0
    # Product cost rose, but because of B: A is not the driver
    b_up = {"A": series([10, 10, 10], start_month=10), "B": series([10, 11, 12], start_month=10)}
    assert exposure.bom_cost_escalation("A", bom, b_up, AS_OF, CFG).status == CLEAR
    assert exposure.bom_cost_escalation("A", [], a_up, AS_OF, CFG).status == NOT_EVALUABLE
    missing_component = {"A": a_up["A"]}  # B has no price history at all
    assert exposure.bom_cost_escalation("A", bom, missing_component, AS_OF, CFG).status == (
        NOT_EVALUABLE
    )


def test_supplier_concentration():
    heavy = [buy(2025, 11, 10, 80, "S1"), buy(2025, 11, 10, 20, "S2")]
    signal = exposure.supplier_concentration(heavy, AS_OF, CFG)
    assert signal.status == TRIGGERED and signal.details["top_supplier"] == "S1"
    assert signal.value == 80.0 and signal.details["hhi"] == pytest.approx(0.68)
    split = [buy(2025, 11, 10, 50, "S1"), buy(2025, 11, 10, 50, "S2")]
    assert exposure.supplier_concentration(split, AS_OF, CFG).status == CLEAR
    nobody = [buy(2025, 11, 10, 50, None)]
    assert exposure.supplier_concentration(nobody, AS_OF, CFG).status == NOT_EVALUABLE
    old = [buy(2023, 1, 10, 50, "S1")]  # outside the one-year window
    assert exposure.supplier_concentration(old, AS_OF, CFG).status == NOT_EVALUABLE


def test_inventory_exposure_needs_low_cover_and_a_rising_price():
    rising = series([100, 103, 106], start_month=10)
    purchases = [buy(2025, 12, 10, 900)]  # 900 over 90 days = 10/day
    low = exposure.inventory_position(
        [InventoryRow(date(2025, 12, 20), 200, None, None)], purchases, AS_OF, CFG
    )
    assert low["coverage_days"] == 20.0
    assert exposure.inventory_cost_exposure(low, rising, AS_OF, CFG).status == TRIGGERED
    plenty = exposure.inventory_position(
        [InventoryRow(date(2025, 12, 20), 5000, None, None)], purchases, AS_OF, CFG
    )
    assert exposure.inventory_cost_exposure(plenty, rising, AS_OF, CFG).status == CLEAR
    flat = series([100, 100, 101], start_month=10)
    assert exposure.inventory_cost_exposure(low, flat, AS_OF, CFG).status == CLEAR
    assert exposure.inventory_cost_exposure(None, rising, AS_OF, CFG).status == NOT_EVALUABLE
    reported = exposure.inventory_position(
        [InventoryRow(date(2025, 12, 20), 5000, None, 7.0)], purchases, AS_OF, CFG
    )
    assert reported["coverage_days"] == 7.0 and "reported" in reported["coverage_source"]


def test_high_spend_ranking():
    assert exposure.high_spend(900, 1, 6, 2000, CFG).status == TRIGGERED
    assert exposure.high_spend(500, 3, 6, 2000, CFG).status == CLEAR
    few = exposure.high_spend(900, 1, 4, 2000, CFG)
    assert few.status == NOT_EVALUABLE and "at least 5" in few.explanation


def test_lead_time_and_delivery_deterioration():
    def ops(month, lead, otd, supplier="S1"):
        return OpsRow(date(2025, month, 1), supplier, lead, otd)

    worse = [ops(8, 10, 0.95), ops(9, 10, 0.95), ops(11, 14, 0.95), ops(12, 14, 0.95)]
    signal = exposure.lead_time_deterioration(worse, AS_OF, CFG)
    assert signal.status == TRIGGERED and "+40%" in signal.explanation
    otd = [ops(8, 10, 0.95), ops(9, 10, 0.95), ops(11, 10, 0.80), ops(12, 10, 0.80)]
    assert exposure.lead_time_deterioration(otd, AS_OF, CFG).status == TRIGGERED
    stable = [ops(8, 10, 0.95), ops(9, 10, 0.95), ops(11, 10.5, 0.94), ops(12, 10, 0.95)]
    assert exposure.lead_time_deterioration(stable, AS_OF, CFG).status == CLEAR
    assert exposure.lead_time_deterioration([ops(12, 10, 0.9)], AS_OF, CFG).status == NOT_EVALUABLE
    assert exposure.lead_time_deterioration([], AS_OF, CFG).status == NOT_EVALUABLE


def test_a_stable_supplier_cannot_hide_a_deteriorating_one():
    def ops(month, supplier, lead, otd=0.95):
        return OpsRow(date(2025, month, 1), supplier, lead, otd)

    bad = [ops(8, "BAD", 10), ops(9, "BAD", 10), ops(11, "BAD", 20), ops(12, "BAD", 20)]
    good = [ops(8, "GOOD", 10), ops(9, "GOOD", 10), ops(11, "GOOD", 10), ops(12, "GOOD", 10)]
    signal = exposure.lead_time_deterioration(bad + good, AS_OF, CFG)
    # Pooled, the two suppliers would average to +50%; per supplier the +100% is not diluted.
    assert signal.status == TRIGGERED
    assert "BAD lead time 10.0 → 20.0 days (+100%)" in signal.explanation
    assert "GOOD" not in signal.explanation
    assert [f["supplier_id"] for f in signal.details["suppliers"] if f["worse"]] == ["BAD"]
    only_good = exposure.lead_time_deterioration(good, AS_OF, CFG)
    assert only_good.status == CLEAR and "Stable across 1 supplier" in only_good.explanation


def test_engine_runs_every_detector_and_never_mixes_currencies():
    data = MaterialData(
        "M1",
        "Steel",
        "Metals",
        "kg",
        purchases=[buy(2025, 11, 10), buy(2025, 12, 10), buy(2025, 12, 99, currency="EUR")],
    )
    result = compute_results([data], [], AS_OF, CFG)[0]
    assert [s.code for s in result.signals] == list(SIGNAL_NAMES)  # catalog matches the engine
    assert result.currency == "USD" and result.metrics["latest_price"] == 10.0
    assert any("EUR" in note for note in result.notes)
    assert compute_results([data], [], AS_OF, CFG)[0].metrics == result.metrics  # deterministic


# ── Part 2: stored data ──────────────────────────────────────────────────────


async def _seed(session: AsyncSession) -> None:
    session.add_all(
        [
            Material(
                material_id="M1", description="Steel coil", category="Metals", unit_of_measure="kg"
            ),
            Material(
                material_id="M2", description="Copper wire", category="Metals", unit_of_measure="kg"
            ),
            Material(
                material_id="M3", description="Glass sheet", category="Glass", unit_of_measure="m2"
            ),
        ]
    )
    for sid in ("S1", "S2"):
        session.add(
            Supplier(
                supplier_id=sid,
                name=f"Supplier {sid}",
                category="Metals",
                risk_tier="Low",
                status="Active",
            )
        )
    await session.commit()
    rows = [
        ("M1", "S1", date(2025, 1, 10), 100, 10.0),
        ("M1", "S1", date(2025, 1, 20), 300, 12.0),
        ("M1", "S1", date(2025, 2, 10), 200, 13.0),
        ("M2", "S2", date(2025, 1, 10), 100, 5.0),
        ("M2", "S2", date(2025, 2, 10), 100, 5.0),
        ("M3", "S1", date(2025, 1, 10), 50, 20.0),
        ("M3", "S2", date(2025, 2, 10), 50, 20.0),
    ]
    for material, supplier, day, qty, unit_price in rows:
        session.add(
            PurchaseRecord(
                material_id=material,
                supplier_id=supplier,
                purchase_date=day,
                quantity=qty,
                unit_price=unit_price,
            )
        )
    session.add(
        BOMEntry(product_sku="P1", material_id="M1", bom_quantity=2.0, unit_of_measure="kg")
    )
    await session.commit()


@pytest.mark.asyncio
async def test_empty_manufacturing_data_gives_a_genuine_empty_state(async_client: AsyncClient):
    body = (await async_client.get(f"{BASE}/overview")).json()["data"]
    assert body["has_data"] is False
    assert body["materials"] == [] and body["summary"] is None and body["as_of"] is None
    assert (await async_client.get(f"{BASE}/materials/M1")).status_code == 404


@pytest.mark.asyncio
async def test_overview_figures_are_computed_from_the_rows_and_change_with_them(
    async_client: AsyncClient, db_session: AsyncSession
):
    await _seed(db_session)
    body = (await async_client.get(f"{BASE}/overview")).json()["data"]
    assert body["has_data"] and body["as_of"] == "2025-02-10"
    m1 = next(m for m in body["materials"] if m["material_id"] == "M1")
    # Jan: (100*10 + 300*12) / 400 = 11.5 ; Feb: 13.0
    assert m1["latest_price"] == 13.0
    assert m1["price_change_1m_pct"] == pytest.approx((13.0 / 11.5 - 1) * 100, abs=0.01)
    assert m1["spend_window_total"] == 100 * 10 + 300 * 12 + 200 * 13
    assert m1["top_supplier"] == "S1" and m1["top_supplier_share_pct"] == 100.0
    assert m1["bom_product_count"] == 1
    codes = {s["code"]: s["status"] for s in m1["signals"]}
    assert codes["rapid_price_increase"] == TRIGGERED
    assert codes["standard_cost_deviation"] == NOT_EVALUABLE  # no standard cost loaded
    assert body["summary"]["spend_window_total"] == pytest.approx(7200 + 1000 + 2000)

    # Change the data: the figures move. Nothing is a fixed number.
    db_session.add(
        PurchaseRecord(
            material_id="M1",
            supplier_id="S1",
            purchase_date=date(2025, 3, 10),
            quantity=100,
            unit_price=26.0,
        )
    )
    await db_session.commit()
    after = (await async_client.get(f"{BASE}/overview")).json()["data"]
    m1_after = next(m for m in after["materials"] if m["material_id"] == "M1")
    assert after["as_of"] == "2025-03-10" and m1_after["latest_price"] == 26.0
    assert m1_after["price_change_1m_pct"] == pytest.approx(100.0)


@pytest.mark.asyncio
async def test_data_after_the_as_of_date_never_influences_the_result(
    async_client: AsyncClient, db_session: AsyncSession
):
    await _seed(db_session)
    before = (await async_client.get(f"{BASE}/overview?as_of=2025-02-28")).json()["data"]
    db_session.add(
        PurchaseRecord(
            material_id="M1",
            supplier_id="S2",
            purchase_date=date(2025, 6, 1),
            quantity=5000,
            unit_price=99.0,
        )
    )
    await db_session.commit()
    after = (await async_client.get(f"{BASE}/overview?as_of=2025-02-28")).json()["data"]
    assert before["materials"] == after["materials"] and before["summary"] == after["summary"]
    later = (await async_client.get(f"{BASE}/overview?as_of=2025-06-30")).json()["data"]
    m1 = next(m for m in later["materials"] if m["material_id"] == "M1")
    assert m1["latest_price"] == 99.0


@pytest.mark.asyncio
async def test_filters_and_detail(async_client: AsyncClient, db_session: AsyncSession):
    await _seed(db_session)

    async def ids(query: str) -> list[str]:
        data = (await async_client.get(f"{BASE}/overview{query}")).json()["data"]
        return sorted(m["material_id"] for m in data["materials"])

    assert await ids("") == ["M1", "M2", "M3"]
    assert await ids("?category=Glass") == ["M3"]
    assert await ids("?supplier_id=S2") == ["M2", "M3"]
    assert await ids("?product_sku=P1") == ["M1"]
    assert await ids("?search=copper") == ["M2"]
    assert await ids("?signal=rapid_price_increase") == ["M1"]
    assert await ids("?category=Nothing") == []
    options = (await async_client.get(f"{BASE}/overview")).json()["data"]["filter_options"]
    assert options["categories"] == ["Glass", "Metals"] and options["products"] == ["P1"]

    detail = (await async_client.get(f"{BASE}/materials/M1")).json()["data"]
    assert [p["unit_price"] for p in detail["price_series"]] == [11.5, 13.0]
    assert detail["supplier_spend"][0]["supplier_id"] == "S1"
    assert all("details" in s for s in detail["signals"])
    assert (await async_client.get(f"{BASE}/materials/NOPE")).status_code == 404


@pytest.mark.asyncio
async def test_overview_roles(client_as, db_session: AsyncSession):
    await _seed(db_session)
    for role, expected in (
        ("admin", 200),
        ("reviewer", 200),
        ("read_only_reviewer", 200),
        ("verifier", 403),
        ("process_owner", 403),
    ):
        who = make_principal("USR-ADMIN-001", f"u_{role}", role, role)
        async with client_as(who) as client:
            assert (await client.get(f"{BASE}/overview")).status_code == expected, role
            assert (await client.get(f"{BASE}/materials/M1")).status_code == expected, role


def test_manufacturing_ui_contains_no_hardcoded_figures_markers():
    for folder in ("app/manufacturing", "components/manufacturing"):
        for path in (REPO_ROOT / "frontend" / folder).rglob("*.ts*"):
            text = path.read_text(encoding="utf-8").lower()
            assert "hardcoded" not in text and "todo: mock" not in text, path


def test_as_of_is_a_date_not_the_clock():
    # The engine never reads the current time: same inputs a year apart give the same output.
    data = MaterialData("M1", "Steel", None, "kg", purchases=[buy(2024, 1, 10), buy(2024, 2, 12)])
    first = compute_results([data], [], date(2024, 3, 1), CFG)[0].metrics
    again = compute_results([data], [], date(2024, 3, 1), CFG)[0].metrics
    assert first == again and first["latest_price"] == 12.0


# ── QA follow-ups (Ticket 6 review) ──────────────────────────────────────────


def test_spend_is_ranked_only_within_a_currency():
    def material(mid, price, currency="USD"):
        purchases = [
            buy(2025, 11, price, 100, currency=currency),
            buy(2025, 12, price, 100, currency=currency),
        ]
        return MaterialData(mid, mid, None, "kg", purchases=purchases)

    usd = [material(f"U{i}", 10 + i) for i in range(5)]
    eur = material("E1", 100_000, currency="EUR")  # enormous, but in another currency
    results = {r.material_id: r for r in compute_results([*usd, eur], [], AS_OF, CFG)}
    top_usd = next(s for s in results["U4"].signals if s.code == "high_spend")
    assert top_usd.status == TRIGGERED and top_usd.details["rank"] == 1  # EUR did not outrank it
    assert top_usd.details["ranked_materials"] == 5
    lone_eur = next(s for s in results["E1"].signals if s.code == "high_spend")
    assert lone_eur.status == NOT_EVALUABLE  # one EUR material cannot be ranked
    assert results["E1"].metrics["spend_share_pct"] == 100.0  # share of EUR spend, not of a sum


def test_bom_escalation_will_not_add_components_in_different_currencies():
    bom = [_bom("P1", "A"), _bom("P1", "B")]
    prices = {"A": series([10, 11, 12], start_month=10), "B": series([10, 10, 10], start_month=10)}
    mixed = exposure.bom_cost_escalation("A", bom, prices, AS_OF, CFG, {"A": "USD", "B": "EUR"})
    assert mixed.status == NOT_EVALUABLE and "mixed currencies" in mixed.explanation
    same = exposure.bom_cost_escalation("A", bom, prices, AS_OF, CFG, {"A": "USD", "B": "USD"})
    assert same.status == TRIGGERED


@pytest.mark.asyncio
async def test_summary_never_adds_up_different_currencies(
    async_client: AsyncClient, db_session: AsyncSession
):
    await _seed(db_session)
    db_session.add(Material(material_id="M9", description="Euro part", unit_of_measure="kg"))
    await db_session.commit()
    db_session.add(
        PurchaseRecord(
            material_id="M9",
            supplier_id="S1",
            purchase_date=date(2025, 2, 1),
            quantity=10,
            unit_price=5.0,
            currency="EUR",
        )
    )
    await db_session.commit()
    summary = (await async_client.get(f"{BASE}/overview")).json()["data"]["summary"]
    assert summary["spend_window_total"] is None  # no single total across currencies
    assert summary["spend_by_currency"] == {"EUR": 50.0, "USD": 10200.0}
    only_usd = (await async_client.get(f"{BASE}/overview?category=Metals")).json()["data"][
        "summary"
    ]
    assert only_usd["currencies"] == ["USD"] and only_usd["spend_window_total"] == 8200.0


@pytest.mark.asyncio
async def test_costs_stock_variance_and_operations_after_the_as_of_date_are_ignored(
    async_client: AsyncClient, db_session: AsyncSession
):
    await _seed(db_session)
    db_session.add_all(
        [
            MaterialCost(
                material_id="M1", version=1, effective_from=date(2025, 6, 1), standard_cost=5.0
            ),
            InventoryRecord(material_id="M1", snapshot_date=date(2025, 6, 15), quantity_on_hand=10),
            VarianceInput(
                material_id="M1",
                period_start=date(2025, 6, 1),
                period_end=date(2025, 6, 30),
                reported_ppv_amount=500.0,
            ),
            SupplierOperationsMetric(
                supplier_id="S1", metric_date=date(2025, 6, 1), lead_time_days=99.0
            ),
        ]
    )
    await db_session.commit()

    async def m1(query: str) -> dict:
        data = (await async_client.get(f"{BASE}/overview{query}")).json()["data"]
        return next(m for m in data["materials"] if m["material_id"] == "M1")

    early = await m1("?as_of=2025-02-28")
    assert early["standard_cost"] is None and early["coverage_days"] is None
    assert early["latest_lead_time_days"] is None
    later = await m1("?as_of=2025-06-30")
    assert later["coverage_days"] is None and later["latest_lead_time_days"] == 99.0
    detail = (await async_client.get(f"{BASE}/materials/M1?as_of=2025-02-28")).json()["data"]
    codes = {s["code"]: s["status"] for s in detail["signals"]}
    assert codes["ppv_trend"] == NOT_EVALUABLE and codes["inventory_cost_exposure"] == NOT_EVALUABLE


@pytest.mark.asyncio
async def test_a_later_material_supplier_link_cannot_attach_earlier_operations(
    async_client: AsyncClient, db_session: AsyncSession
):
    await _seed(db_session)
    db_session.add(MaterialSupplier(material_id="M1", supplier_id="S2"))  # M1 never bought from S2
    for day, lead in (
        (date(2024, 9, 1), 10.0),
        (date(2024, 10, 1), 10.0),
        (date(2024, 12, 1), 30.0),
        (date(2025, 1, 1), 30.0),
    ):
        db_session.add(
            SupplierOperationsMetric(supplier_id="S2", metric_date=day, lead_time_days=lead)
        )
    await db_session.commit()
    detail = (await async_client.get(f"{BASE}/materials/M1?as_of=2025-02-10")).json()["data"]
    lead = next(s for s in detail["signals"] if s["code"] == "lead_time_deterioration")
    assert lead["status"] == NOT_EVALUABLE  # S2 is not a supplier M1 had bought from by then


@pytest.mark.asyncio
async def test_unknown_signal_filter_is_rejected(
    async_client: AsyncClient, db_session: AsyncSession
):
    await _seed(db_session)
    res = await async_client.get(f"{BASE}/overview?signal=bogus")
    assert res.status_code == 422 and "Unknown signal 'bogus'" in res.json()["message"]
    assert (await async_client.get(f"{BASE}/overview?signal=high_spend")).status_code == 200


@pytest.mark.asyncio
async def test_date_before_any_purchase_is_not_shown_as_no_data(
    async_client: AsyncClient, db_session: AsyncSession
):
    await _seed(db_session)
    body = (await async_client.get(f"{BASE}/overview?as_of=2024-12-31")).json()["data"]
    assert body["has_data"] is True  # data exists, just not by that date
    assert body["materials"] == [] and body["summary"] is None
    assert "earliest purchase is 2025-01-10" in body["notice"]
    normal = (await async_client.get(f"{BASE}/overview")).json()["data"]
    assert normal["notice"] is None
