"""
Ticket 7 — Forecasting engine.

Required by the ticket and decision D5:
- test_forecast_horizon_withheld_when_insufficient_data
- test_validation_rejects_post_cutoff_data_leakage
The rest cover the baselines and statsmodels regressions, held-out scoring recomputed by hand,
model selection, the stored run metadata, reproducibility, immutability and roles.
"""

import warnings
from datetime import date

import numpy as np
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.custom_exceptions.exceptions import DataLeakageError
from app.api.modules.v1.manufacturing.models import ForecastRun, Material, PurchaseRecord
from app.api.modules.v1.manufacturing.service import forecast_engine as engine
from app.api.modules.v1.manufacturing.service import forecast_models as models
from app.api.modules.v1.manufacturing.service.analytics_types import MonthPoint
from app.api.modules.v1.manufacturing.service.forecast_types import (
    DEFAULT_FORECAST_CONFIG,
    FORECAST,
    WITHHELD,
    CandidateResult,
)
from tests.conftest import make_principal

CFG = DEFAULT_FORECAST_CONFIG
BASE = "/api/v1/manufacturing/forecasting"


def month_points(prices, start=(2024, 1)):
    year, month = start
    out = []
    for price in prices:
        out.append(MonthPoint(date(year, month, 1), float(price), 100.0))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return out


def noisy_line(n, slope=0.3, seed=1):
    rng = np.random.default_rng(seed)
    return [10 + slope * i + rng.normal(0, 0.1) for i in range(n)]


def cutoff_for(n, start=(2024, 1)):
    index = start[0] * 12 + start[1] - 1 + n - 1
    return date(index // 12, index % 12 + 1, 28)


# ── Requirements on history ──────────────────────────────────────────────────


def test_history_requirements_follow_from_the_scoring_design():
    assert CFG.horizon_months(30) == 1 and CFG.horizon_months(90) == 3
    # train 9 + 4 scoring origins + (horizon - 1): every origin has a real, unseen target
    assert CFG.required_months(30) == 13 and CFG.required_months(90) == 15


def test_forecast_horizon_withheld_when_insufficient_data_engine():
    points = month_points(noisy_line(14))
    short_30 = engine.run_horizon(points, cutoff_for(14), 30, "USD")
    short_90 = engine.run_horizon(points, cutoff_for(14), 90, "USD")
    assert short_30.status == FORECAST and short_30.path
    assert short_90.status == WITHHELD and short_90.path == [] and short_90.model_name is None
    assert (
        "needs 15 consecutive months" in short_90.reason and "14 are available" in short_90.reason
    )
    too_short = engine.run_horizon(month_points(noisy_line(8)), cutoff_for(8), 30, "USD")
    assert too_short.status == WITHHELD


def test_a_month_priced_at_zero_is_withheld_not_a_division_by_zero():
    prices = noisy_line(20)
    prices[10] = 0.0
    out = engine.run_horizon(month_points(prices), cutoff_for(20), 30, "USD")
    assert out.status == WITHHELD and out.path == []
    assert out.reason == engine.PRICE_NOT_POSITIVE_REASON


def test_a_missing_month_ends_the_usable_history_and_is_never_filled():
    prices = noisy_line(24)
    points = [p for i, p in enumerate(month_points(prices)) if i != 18]  # month 19 missing
    outcome = engine.run_horizon(points, cutoff_for(24), 30, "USD")
    assert outcome.status == WITHHELD and outcome.available_months == 5
    assert "missing months" in outcome.reason


# ── Models ───────────────────────────────────────────────────────────────────


def test_baseline_models_compute_the_documented_values():
    y = np.array([10.0, 11.0, 12.0, 13.0])
    assert models.predict("naive", y, 1, CFG)[0].value == 13.0
    assert models.predict("moving_average", y, 1, CFG)[0].value == pytest.approx(12.0)
    smoothed, params = models.predict("exponential_smoothing", y, 1, CFG)
    assert 11.0 < smoothed.value < 13.0 and 0.05 <= params["alpha"] <= 0.95
    for code in ("naive", "moving_average", "exponential_smoothing"):
        assert models.predict(code, y, 1, CFG)[0].lower is None  # no band without a basis


def test_regression_models_use_statsmodels_and_give_a_prediction_band():
    y = np.array(noisy_line(20))
    for code in ("trend_regression", "lagged_regression"):
        prediction, params = models.predict(code, y, 3, CFG)
        assert prediction.lower < prediction.value < prediction.upper, code
        assert params
    trend, params = models.predict("trend_regression", y, 1, CFG)
    assert params["slope_per_month"] == pytest.approx(0.3, abs=0.05)
    assert trend.value == pytest.approx(10 + 0.3 * 20, abs=0.3)  # extends the fitted line
    assert models.MODELS["trend_regression"][0].kind == "regression"


def test_a_perfectly_regular_series_is_handled_without_warnings():
    y = np.array([10 + 0.1 * i for i in range(24)])
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        outcome = engine.run_horizon(month_points(y), cutoff_for(24), 30, "USD")
    lagged = next(c for c in outcome.candidates if c.code == "lagged_regression")
    assert lagged.eligible is False and "too regular" in lagged.note


def test_non_positive_forecasts_are_rejected_not_reported():
    falling = np.array([10.0 - 1.4 * i for i in range(7)] + [0.2, 0.15])
    with pytest.raises(models.ModelUnavailableError):
        models.predict("trend_regression", falling, 12, CFG)


# ── Held-out scoring, recalculated independently ─────────────────────────────


def test_held_out_scores_match_a_hand_calculation():
    y = np.array([10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17, 16, 18], dtype=float)
    scored = engine._score_candidate("naive", y, 1, CFG)  # noqa: SLF001
    # Origins end at lengths 10..13; naive predicts the last training value, actual is next.
    errors = [y[e - 1] - y[e] for e in range(10, 14)]
    assert scored.origins_scored == 4
    assert scored.mae == pytest.approx(np.mean(np.abs(errors)))
    assert scored.rmse == pytest.approx(np.sqrt(np.mean(np.square(errors))))
    assert scored.mape == pytest.approx(
        np.mean([abs(y[e - 1] - y[e]) / y[e] for e in range(10, 14)]) * 100
    )
    moved = [np.sign(y[e] - y[e - 1]) == np.sign(0) for e in range(10, 14)]
    assert scored.directional_accuracy == pytest.approx(np.mean(moved))


def _candidate(code, kind, mae):
    spec = models.MODELS[code][0]
    return CandidateResult(code, spec.name, spec.version, kind, mae=mae, origins_scored=4)


def test_a_regression_must_clearly_beat_the_baseline_to_be_chosen():
    base = _candidate("naive", "baseline", 1.0)
    clearly = _candidate("trend_regression", "regression", 0.8)
    barely = _candidate("trend_regression", "regression", 0.95)
    assert engine.select_model([base, clearly], CFG)[0].code == "trend_regression"
    chosen, why = engine.select_model([base, barely], CFG)
    assert chosen.code == "naive" and "short of the 10% improvement" in why
    worse = engine.select_model([base, _candidate("lagged_regression", "regression", 2.0)], CFG)
    assert worse[0].code == "naive" and "higher error" in worse[1]
    equal_base = [
        _candidate("naive", "baseline", 1.0),
        _candidate("moving_average", "baseline", 1.0),
    ]
    assert engine.select_model(equal_base, CFG)[0].code == "naive"  # ties go to the simpler model


def test_trending_data_selects_a_regression_and_flat_data_a_baseline():
    trend = engine.run_horizon(month_points(noisy_line(24)), cutoff_for(24), 30, "USD")
    assert trend.model_code in ("trend_regression", "lagged_regression")
    assert trend.path[-1].lower is not None and trend.interval_level == 0.8
    flat_prices = np.random.default_rng(7).normal(10, 0.2, 24)
    flat = engine.run_horizon(month_points(flat_prices), cutoff_for(24), 30, "USD")
    assert flat.model_code in ("naive", "moving_average", "exponential_smoothing")
    assert flat.path[-1].lower is None  # a baseline gives no band
    assert "chosen" in flat.selection_rationale and len(flat.candidates) == 5


# ── D5: no hindsight ─────────────────────────────────────────────────────────


def test_validation_rejects_post_cutoff_data_leakage():
    """Deliberately feed a post-cutoff point to the engine: it must be rejected, not trimmed."""
    points = month_points(noisy_line(20))
    cutoff = date(2025, 5, 31)  # history runs to Aug 2025, so 3 points lie after the cutoff
    with pytest.raises(DataLeakageError, match=r"3 data point\(s\) dated after the cutoff"):
        engine.run_horizon(points, cutoff, 30, "USD")
    # An obviously planted future value must not be silently dropped either
    planted = [*points[:17], MonthPoint(date(2025, 12, 1), 9999.0, 1.0)]
    with pytest.raises(DataLeakageError):
        engine.run_horizon(planted, date(2025, 6, 30), 30, "USD")
    # The same history is fine once the cutoff genuinely covers it
    assert engine.run_horizon(points, date(2025, 8, 31), 30, "USD").status == FORECAST


def test_scoring_never_shows_a_model_the_value_it_is_scored_against(monkeypatch):
    seen = []
    real_predict = models.predict

    def spy(code, train, horizon_months, cfg):
        seen.append((len(train), horizon_months, float(train.max())))
        return real_predict(code, train, horizon_months, cfg)

    monkeypatch.setattr(models, "predict", spy)
    n, sentinel = 16, 777.0
    prices = [*noisy_line(n - 1), sentinel]  # the very last month is distinctive
    engine.run_horizon(month_points(prices), cutoff_for(n), 30, "USD")
    scoring = [s for s in seen if s[0] < n]
    # With one-month horizon the last observation is the final scoring target (index n-1):
    assert max(length for length, _, _ in scoring) == n - 1
    assert all(peak < sentinel for _, _, peak in scoring)  # no scoring fit contained the target
    assert any(peak == sentinel for _, _, peak in seen)  # only the final forecast sees it


def test_forecasts_are_reproducible_and_the_fingerprint_tracks_the_data():
    points = month_points(noisy_line(24))
    first = engine.run_horizon(points, cutoff_for(24), 90, "USD")
    again = engine.run_horizon(points, cutoff_for(24), 90, "USD")
    assert first.dataset_version == again.dataset_version
    assert first.path == again.path and first.model_code == again.model_code
    changed = [*points[:-1], MonthPoint(points[-1].month, points[-1].price + 0.5, 100.0)]
    other = engine.run_horizon(changed, cutoff_for(24), 90, "USD")
    assert other.dataset_version != first.dataset_version
    in_euro = engine.run_horizon(points, cutoff_for(24), 90, "EUR")
    assert in_euro.dataset_version != first.dataset_version  # currency is part of the data


# ── Stored runs through the API ──────────────────────────────────────────────


async def _seed_series(
    session: AsyncSession, material_id: str, prices, start=(2024, 1), dataset_id=None
):
    session.add(
        Material(
            material_id=material_id,
            description=f"{material_id} part",
            category="Metals",
            unit_of_measure="kg",
        )
    )
    await session.commit()
    year, month = start
    for price in prices:
        session.add(
            PurchaseRecord(
                material_id=material_id,
                purchase_date=date(year, month, 10),
                quantity=100,
                unit_price=float(price),
                dataset_id=dataset_id,
            )
        )
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    await session.commit()


async def _run_count(session: AsyncSession) -> int:
    return (await session.execute(select(func.count()).select_from(ForecastRun))).scalar_one()


@pytest.mark.asyncio
async def test_forecast_horizon_withheld_when_insufficient_data(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Required: with too little history the API must not return (or store) a 90-day forecast."""
    await _seed_series(db_session, "M14", noisy_line(15))  # 14 complete months: 30 days, not 90
    res = await async_client.post(f"{BASE}/materials/M14/run")
    assert res.status_code == 201
    by_days = {h["horizon_days"]: h for h in res.json()["data"]["horizons"]}
    assert by_days[30]["status"] == "forecast" and by_days[30]["run"]["forecast"]["value"] > 0
    ninety = by_days[90]
    assert ninety["status"] == "withheld" and ninety["run"] is None
    assert ninety["required_months"] == 15 and ninety["available_months"] == 14
    assert "forecast" not in ninety and "value" not in str(ninety["run"])
    assert await _run_count(db_session) == 1  # nothing stored for the withheld horizon
    read_back = (await async_client.get(f"{BASE}/materials/M14")).json()["data"]
    assert next(h for h in read_back["horizons"] if h["horizon_days"] == 90)["status"] == "withheld"

    await _seed_series(db_session, "M6", noisy_line(6))
    short = (await async_client.post(f"{BASE}/materials/M6/run")).json()["data"]["horizons"]
    assert [h["status"] for h in short] == ["withheld", "withheld"]


@pytest.mark.asyncio
async def test_a_run_stores_complete_metadata_and_reruns_never_alter_history(
    async_client: AsyncClient, db_session: AsyncSession
):
    await _seed_series(db_session, "M24", noisy_line(25))  # 24 complete months + a partial one
    first = (await async_client.post(f"{BASE}/materials/M24/run")).json()["data"]
    runs = {h["horizon_days"]: h["run"] for h in first["horizons"]}
    run = runs[90]
    assert run["model"]["name"] and run["model"]["version"] == "1.0"
    assert run["dataset_version"].startswith("sha256:") and run["horizon_months"] == 3
    assert run["as_of"] == "2026-01-10" and run["history"]["months"] == 24
    assert run["history"]["frequency"] == "monthly" and run["created_by"] == "USR-TEST-001"
    assert run["selection_rationale"] and len(run["candidates"]) == 5
    assert sum(c["selected"] for c in run["candidates"]) == 1
    assert all(c["mae"] is not None for c in run["candidates"] if c["eligible"])
    assert run["forecast"]["month"] == "2026-03-01" and run["forecast"]["last_observed_price"]
    assert len(run["path"]) == 3  # one point per month up to the horizon

    stored = await db_session.get(ForecastRun, run["run_id"])
    snapshot = (stored.forecast_value, stored.candidates, stored.config, stored.created_at)

    second = (await async_client.post(f"{BASE}/materials/M24/run")).json()["data"]
    again = {h["horizon_days"]: h["run"] for h in second["horizons"]}[90]
    assert again["run_id"] != run["run_id"]  # a new, separate record
    assert again["dataset_version"] == run["dataset_version"]  # same data...
    assert again["forecast"]["value"] == run["forecast"]["value"]  # ...same forecast
    assert again["model"] == run["model"]
    await db_session.refresh(stored)
    assert (stored.forecast_value, stored.candidates, stored.config, stored.created_at) == snapshot
    assert await _run_count(db_session) == 4
    listing = (await async_client.get(f"{BASE}/materials/M24/runs")).json()["data"]["runs"]
    assert len(listing) == 4
    one = (await async_client.get(f"{BASE}/runs/{run['run_id']}")).json()["data"]
    assert one["run_id"] == run["run_id"]
    assert (await async_client.get(f"{BASE}/runs/FRC-nope")).status_code == 404


@pytest.mark.asyncio
async def test_data_after_the_cutoff_cannot_change_a_stored_forecast(
    async_client: AsyncClient, db_session: AsyncSession
):
    await _seed_series(db_session, "MC", noisy_line(20))  # Jan 2024 .. Aug 2025
    cutoff = "2025-08-31"
    before = (await async_client.post(f"{BASE}/materials/MC/run?as_of={cutoff}")).json()["data"]
    db_session.add(
        PurchaseRecord(
            material_id="MC", purchase_date=date(2025, 9, 30), quantity=100, unit_price=500.0
        )
    )  # a planted future spike
    await db_session.commit()
    after = (await async_client.post(f"{BASE}/materials/MC/run?as_of={cutoff}")).json()["data"]

    def pick(payload):
        return {h["horizon_days"]: h["run"] for h in payload["horizons"]}[30]

    assert pick(before)["dataset_version"] == pick(after)["dataset_version"]
    assert pick(before)["forecast"]["value"] == pick(after)["forecast"]["value"]
    assert pick(after)["history"]["end"] == "2025-08-01"
    assert max(p["month"] for p in after["history"]) == "2025-08-01"
    latest = (await async_client.post(f"{BASE}/materials/MC/run")).json()["data"]
    assert pick(latest)["forecast"]["value"] != pick(after)["forecast"]["value"]  # now it counts


@pytest.mark.asyncio
async def test_forecast_roles_and_empty_states(client_as, db_session: AsyncSession):
    await _seed_series(db_session, "MR", noisy_line(24))
    for role, can_read, can_run in (
        ("admin", 200, 201),
        ("reviewer", 200, 201),
        ("read_only_reviewer", 200, 403),
        ("verifier", 403, 403),
        ("process_owner", 403, 403),
    ):
        who = make_principal("USR-ADMIN-001", f"f_{role}", role, role)
        async with client_as(who) as client:
            assert (await client.get(f"{BASE}/materials/MR")).status_code == can_read, role
            assert (await client.get(f"{BASE}/materials")).status_code == can_read, role
            assert (await client.post(f"{BASE}/materials/MR/run")).status_code == can_run, role
    assert await _run_count(db_session) == 4  # only admin and reviewer stored runs (2 each)


@pytest.mark.asyncio
async def test_empty_and_unknown_inputs(async_client: AsyncClient, db_session: AsyncSession):
    empty = (await async_client.get(f"{BASE}/materials")).json()["data"]
    assert empty["has_data"] is False and empty["materials"] == []
    assert (await async_client.post(f"{BASE}/materials/NOPE/run")).status_code == 404
    await _seed_series(db_session, "MX", noisy_line(15))
    listing = (await async_client.get(f"{BASE}/materials")).json()["data"]["materials"]
    assert (
        listing[0]["supported_horizons_days"] == [30] and listing[0]["usable_history_months"] == 14
    )
    assert (await async_client.get(f"{BASE}/materials/NOPE")).status_code == 404


# ── QA follow-ups (Ticket 7 review) ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_an_incomplete_final_month_is_excluded_and_reported(
    async_client: AsyncClient, db_session: AsyncSession
):
    await _seed_series(db_session, "MP", noisy_line(15))  # Jan 2024 .. Mar 2025, bought on the 10th
    mid_month = (await async_client.get(f"{BASE}/materials/MP")).json()["data"]
    assert mid_month["as_of"] == "2025-03-10"
    assert mid_month["excluded_partial_month"] == "2025-03-01"  # the 10th is not month end
    assert mid_month["usable_history_months"] == 14
    assert max(p["month"] for p in mid_month["history"]) == "2025-02-01"
    month_end = (await async_client.get(f"{BASE}/materials/MP?as_of=2025-03-31")).json()["data"]
    assert month_end["excluded_partial_month"] is None and month_end["usable_history_months"] == 15
    assert max(p["month"] for p in month_end["history"]) == "2025-03-01"
    run = (await async_client.post(f"{BASE}/materials/MP/run")).json()["data"]
    assert run["excluded_partial_month"] == "2025-03-01"
    stored_30 = next(h for h in run["horizons"] if h["horizon_days"] == 30)["run"]
    assert (
        stored_30["history"]["end"] == "2025-02-01"
        and stored_30["forecast"]["month"] == "2025-03-01"
    )


@pytest.mark.asyncio
async def test_forecast_run_rows_are_immutable_in_the_database(
    async_client: AsyncClient, db_session: AsyncSession
):
    from sqlalchemy import text

    from app.api.db.triggers import FORECAST_RUN_IMMUTABILITY_SQL

    await _seed_series(db_session, "MI", noisy_line(24))
    await db_session.execute(text(FORECAST_RUN_IMMUTABILITY_SQL))  # as the migration does
    await db_session.commit()
    run = (await async_client.post(f"{BASE}/materials/MI/run")).json()["data"]["horizons"][0]["run"]

    with pytest.raises(Exception, match="immutable"):
        await db_session.execute(
            text("UPDATE forecast_runs SET forecast_value = 1 WHERE run_id = :r"),
            {"r": run["run_id"]},
        )
    await db_session.rollback()
    with pytest.raises(Exception, match="immutable"):
        await db_session.execute(
            text("DELETE FROM forecast_runs WHERE run_id = :r"), {"r": run["run_id"]}
        )
    await db_session.rollback()
    kept = await db_session.get(ForecastRun, run["run_id"])
    assert kept is not None and kept.forecast_value == run["forecast"]["value"]
    again = await async_client.post(f"{BASE}/materials/MI/run")  # inserting is still allowed
    assert again.status_code == 201


@pytest.mark.asyncio
async def test_a_run_is_only_shown_for_the_dataset_scope_it_was_made_for(
    async_client: AsyncClient, db_session: AsyncSession
):
    await _seed_series(db_session, "MD", noisy_line(25), dataset_id="DS-A")
    await async_client.post(f"{BASE}/materials/MD/run?dataset_id=DS-A")
    scoped = (await async_client.get(f"{BASE}/materials/MD?dataset_id=DS-A")).json()["data"]
    assert [h["status"] for h in scoped["horizons"]] == ["forecast", "forecast"]
    unscoped = (await async_client.get(f"{BASE}/materials/MD")).json()["data"]
    assert [h["status"] for h in unscoped["horizons"]] == ["not_run", "not_run"]  # different scope
    runs = (await async_client.get(f"{BASE}/materials/MD/runs")).json()["data"]["runs"]
    assert len(runs) == 2  # the history lists everything unless a dataset is given
    only_ds = (await async_client.get(f"{BASE}/materials/MD/runs?dataset_id=DS-B")).json()["data"]
    assert only_ds["runs"] == []


@pytest.mark.asyncio
async def test_a_known_material_without_purchases_by_the_date_is_not_found(
    async_client: AsyncClient, db_session: AsyncSession
):
    await _seed_series(db_session, "MN", noisy_line(20))
    for call in (async_client.get, async_client.post):
        url = f"{BASE}/materials/MN" + ("/run" if call == async_client.post else "")
        res = await call(f"{url}?as_of=2000-01-01")
        assert res.status_code == 404 and "no purchases up to 2000-01-01" in res.json()["message"]
