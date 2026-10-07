"""
Manufacturing summary for the main dashboard, and the stored results behind the Material Cost
table and detail.

Every figure is compared with what the existing endpoints return for the same data, or with a
hand calculation: MAT-A is bought every month at 100 (30 kg from SUP-1, 20 kg from SUP-2); a
stored 30-day forecast of 110 is a 10% rise and, at 50 kg a month, an exposure of 500.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import make_principal
from tests.modules.v1.exposure_seed import AS_OF_Q, EXPOSURE, seed_material, store_run
from tests.modules.v1.test_material_case_integration import MCASE, RISK, SENSITIVE

SUMMARY = "/api/v1/manufacturing/dashboard/summary"
RESULTS = "/api/v1/manufacturing/dashboard/material-results"


async def get(client: AsyncClient, url: str, **params):
    res = await client.get(url, params={**AS_OF_Q, **params})
    assert res.status_code == 200, res.text
    return res.json()["data"]


async def two_currencies(session: AsyncSession) -> None:
    await seed_material(session, "MAT-A")  # USD, two suppliers
    await seed_material(session, "MAT-E", currency="EUR", suppliers=(("SUP-3", 50.0),))
    await store_run(session, "MAT-A", 30, [110.0])  # +10%, exposure 500
    await store_run(session, "MAT-A", 90, [104.0, 108.0, 112.0])
    await store_run(session, "MAT-E", 30, [95.0], currency="EUR")  # -5%
    await store_run(session, "MAT-E", 90, [96.0, 97.0, 98.0], currency="EUR")


@pytest.mark.asyncio
async def test_an_empty_database_says_there_is_no_data(async_client: AsyncClient):
    res = await async_client.get(SUMMARY)
    assert res.status_code == 200
    assert res.json()["data"] == {"has_data": False, "as_of": None}
    results = (await async_client.get(RESULTS)).json()["data"]
    assert results["has_data"] is False and results["materials"] == {}


@pytest.mark.asyncio
async def test_data_without_forecasts_or_scores_shows_reasons_not_results(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session)
    data = await get(async_client, SUMMARY)
    assert data["high_risk"]["reason_empty"] == "No risk scores are stored yet."
    assert data["projected_exposure"]["reason_empty"] == "No forecasts are stored yet."
    assert data["forecast_increase_30d"]["reason_empty"] == "No 30-day forecasts are stored yet."
    assert data["projected_exposure"]["by_currency"] == {}
    assert data["top_exposure"] == [] and data["risk_trend"] == []


@pytest.mark.asyncio
async def test_figures_match_the_exposure_endpoint_and_currencies_stay_apart(
    async_client: AsyncClient, db_session: AsyncSession
):
    await two_currencies(db_session)
    data = await get(async_client, SUMMARY)
    exposure = await get(async_client, EXPOSURE, horizon_days=90)
    expected: dict[str, float] = {}
    for row in exposure["materials"]:
        expected[row["currency"]] = expected.get(row["currency"], 0.0) + row["projected_exposure"]
    assert set(data["projected_exposure"]["by_currency"]) == {"EUR", "USD"}
    for currency, total in expected.items():
        assert data["projected_exposure"]["by_currency"][currency] == pytest.approx(total, abs=0.01)
    assert data["projected_exposure"]["materials_counted"] == 2
    # one ranking per currency, never one list across currencies
    assert {r["currency"] for r in data["top_exposure"]} == {"EUR", "USD"}


@pytest.mark.asyncio
async def test_thirty_day_increase_counts_only_forecasts_above_the_last_price(
    async_client: AsyncClient, db_session: AsyncSession
):
    await two_currencies(db_session)
    data = await get(async_client, SUMMARY)
    assert data["forecast_increase_30d"] == {"count": 1, "forecasted": 2, "reason_empty": None}
    results = await get(async_client, RESULTS)
    assert results["materials"]["MAT-A"]["forecasts"]["30"]["change_pct"] == 10.0
    assert results["materials"]["MAT-E"]["forecasts"]["30"]["change_pct"] == -5.0
    assert results["materials"]["MAT-A"]["forecasts"]["90"]["model"] == "Naive"


@pytest.mark.asyncio
async def test_supplier_concentration_exposure_uses_only_single_supplier_materials(
    async_client: AsyncClient, db_session: AsyncSession
):
    await two_currencies(db_session)
    overview = await get(async_client, "/api/v1/manufacturing/analytics/overview")
    mat_e = next(m for m in overview["materials"] if m["material_id"] == "MAT-E")
    block = (await get(async_client, SUMMARY))["supplier_concentration"]
    assert block["count"] >= 1
    assert block["spend_by_currency"].get("EUR") == pytest.approx(
        mat_e["spend_window_total"], abs=0.01
    )
    assert "USD" not in block["spend_by_currency"]  # MAT-A is split 60/40, not concentrated


@pytest.mark.asyncio
async def test_high_risk_count_trend_and_open_case_come_from_the_stored_scores(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session)
    await store_run(db_session, "MAT-A", 30, [110.0])
    await store_run(db_session, "MAT-A", 90, [104.0, 108.0, 112.0])
    first = await async_client.post(f"{RISK}/run", params=AS_OF_Q)
    assert first.status_code == 201
    before = await get(async_client, SUMMARY)
    assert before["high_risk"]["count"] == 0 and before["high_risk"]["scored"] == 1
    saved = await async_client.post(
        f"{RISK}/weights", json={"config": SENSITIVE, "note": "High from 20 for the test"}
    )
    assert saved.status_code == 201
    second = await async_client.post(f"{RISK}/run", params=AS_OF_Q)
    score = second.json()["data"]["scored"][0]
    data = await get(async_client, SUMMARY)
    assert data["high_risk"]["count"] == 1
    assert data["high_risk"]["materials"][0]["material_id"] == "MAT-A"
    # one trend point per weight version; the earlier one is kept, not overwritten
    assert [p["weight_version"] for p in data["risk_trend"]] == [1, 2]
    assert [p["high_or_critical"] for p in data["risk_trend"]] == [0, 1]
    assert (await get(async_client, RESULTS))["materials"]["MAT-A"]["open_case"] is None
    opened = await async_client.post(MCASE, json={"score_id": score["score_id"]})
    assert opened.status_code == 201
    case = (await get(async_client, RESULTS))["materials"]["MAT-A"]["open_case"]
    assert case["case_id"] == opened.json()["data"]["case"]["case_id"]
    top = (await get(async_client, SUMMARY))["top_exposure"][0]
    assert top["open_case"]["case_id"] == case["case_id"] and top["level"] == "High"


@pytest.mark.asyncio
async def test_reading_the_summary_stores_nothing(
    async_client: AsyncClient, db_session: AsyncSession
):
    await two_currencies(db_session)
    await async_client.post(f"{RISK}/run", params=AS_OF_Q)

    async def counts():
        out = []
        for table in ("forecast_runs", "material_risk_scores", "security_audit_log", "risk_cases"):
            result = await db_session.execute(text(f"SELECT count(*) FROM {table}"))
            out.append(result.scalar_one())
        return out

    before = await counts()
    await get(async_client, SUMMARY)
    await get(async_client, RESULTS)
    assert await counts() == before


@pytest.mark.asyncio
async def test_only_roles_that_see_the_manufacturing_section_can_read_it(client_as):
    for role, allowed in (
        ("reviewer", True),
        ("admin", True),
        ("read_only_reviewer", True),
        ("verifier", False),
        ("process_owner", False),
    ):
        who = make_principal(f"USR-{role}", role, role, role)
        async with client_as(who) as client:
            for url in (SUMMARY, RESULTS):
                res = await client.get(url)
                assert res.status_code == (200 if allowed else 403), (role, url, res.status_code)


@pytest.mark.asyncio
async def test_a_view_as_of_an_earlier_date_shows_no_later_score_sets(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session)
    await store_run(db_session, "MAT-A", 30, [110.0])
    assert (await async_client.post(f"{RISK}/run", params=AS_OF_Q)).status_code == 201
    later = await get(async_client, SUMMARY)
    assert len(later["risk_trend"]) == 1
    earlier = await get(async_client, SUMMARY, as_of="2026-03-31")
    assert earlier["risk_trend"] == []  # the stored scores are for 30 April
