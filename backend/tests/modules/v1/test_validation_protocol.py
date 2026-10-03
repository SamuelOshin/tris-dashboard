# ruff: noqa: E501
"""
Ticket 11 — Retrospective validation protocol (decision D5).

Required by the ticket:
- test_validation_rejects_post_cutoff_data_leakage: deliberately puts a post-cutoff record where
  the fit would read it and requires the run to be refused, not to carry on.
The rest cover the protocol steps in order: cutoff selection, use-only-prior-data, freeze before
reveal, the metrics (hand-calculated), failed runs being kept, and no cherry-picking.

Fixed data: two materials with 30 months of purchases (July 2023 to December 2025, on the last day
of each month): V-TREND rises steadily; V-SPIKE is flat and then jumps 12% in the last two months,
an event no history could foretell.
"""

from datetime import date
from types import SimpleNamespace

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.custom_exceptions.exceptions import DataLeakageError
from app.api.modules.v1.manufacturing.models import BOMEntry
from app.api.modules.v1.manufacturing.service import forecast_engine
from app.api.modules.v1.manufacturing.service import validation_metrics as metrics
from app.api.modules.v1.manufacturing.service import validation_service as validation
from app.api.modules.v1.manufacturing.service.analytics_types import (
    MaterialData,
    MonthPoint,
    PurchaseRow,
)
from app.api.modules.v1.manufacturing.service.validation_types import (
    METHOD_VERSION,
    FrozenCase,
    ValidationConfig,
)
from tests.conftest import make_principal
from tests.modules.v1.validation_seed import (
    VALIDATION,
    flat_then_spike,
    month_end_of,
    seed_series,
    trending,
)

CFG = ValidationConfig()
RUNS = f"{VALIDATION}/runs"


async def seed_standard(session: AsyncSession) -> date:
    await seed_series(session, "V-TREND", trending(30))
    return await seed_series(session, "V-SPIKE", flat_then_spike(30), supplier="SUP-V2")


async def run(client: AsyncClient, **body) -> dict:
    res = await client.post(RUNS, json=body)
    assert res.status_code == 201, res.text
    return res.json()["data"]


async def count(session: AsyncSession, table: str) -> int:
    return (await session.execute(text(f"SELECT count(*) FROM {table}"))).scalar_one()


# ── The mandatory leakage test (D5) ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_validation_rejects_post_cutoff_data_leakage(
    async_client: AsyncClient, db_session: AsyncSession, monkeypatch
):
    """Required. A record dated after the cutoff is put where the fit would read it; every layer must refuse."""
    cutoff = date(2025, 3, 31)
    leaked_day = date(2025, 4, 9)

    # 1. The data-layer guard refuses a loaded record dated after the cutoff.
    data = MaterialData("M", "M", None, "kg")
    data.purchases = [
        PurchaseRow(date(2025, 3, 15), 10, 100.0, "S", None, "USD"),
        PurchaseRow(leaked_day, 10, 9999.0, "S", None, "USD"),  # the planted post-cutoff point
    ]
    with pytest.raises(DataLeakageError, match="after the cutoff 2025-03-31"):
        validation.assert_no_future_records(data, cutoff)

    # 2. The forecast engine refuses a monthly point after the cutoff and never trims it silently.
    points = [MonthPoint(date(2024, m, 1), 100.0 + m, 10.0) for m in range(1, 13)]
    points += [MonthPoint(date(2025, m, 1), 112.0 + m, 10.0) for m in range(1, 5)]  # April is after
    with pytest.raises(DataLeakageError):
        forecast_engine.run_horizon(points, cutoff, 30, "USD")

    # 3. Through the whole harness: the query layer is made to fail (it hands back a later record,
    # as a broken date filter would). The run must stop, not forecast from it.
    await seed_standard(db_session)
    real_load = validation.loader.load_material_data

    async def leaky_load(session, as_of, dataset_id):
        materials, bom = await real_load(session, as_of, dataset_id)
        victim = materials[0]
        victim.purchases = [
            *victim.purchases,
            PurchaseRow(date(as_of.year + 1, 1, 9), 10, 9999.0, "SUP-V1", None, "USD"),
        ]
        return materials, bom

    monkeypatch.setattr(validation.loader, "load_material_data", leaky_load)
    user = SimpleNamespace(user_id="USR-TEST-001")
    with pytest.raises(DataLeakageError):
        await validation.run_validation(db_session, user, CFG)
    await db_session.rollback()
    # nothing was forecast from the leaked record, and the failed run is kept, not erased
    assert await count(db_session, "validation_cases") == 0
    assert await count(db_session, "validation_outcomes") == 0
    assert await count(db_session, "validation_summaries") == 0
    assert await count(db_session, "validation_runs") == 1
    monkeypatch.setattr(validation.loader, "load_material_data", real_load)
    listed = await validation.list_runs(db_session)
    assert [r["status"] for r in listed] == ["incomplete"]
    stopped = await validation.get_run(db_session, listed[0]["run_id"])
    assert stopped["metrics"] is None
    # and the reason it stopped is kept with it, not only returned once to the caller
    assert stopped["failure"]["error_type"] == "DataLeakageError"
    assert "after the cutoff" in stopped["failure"]["message"]
    assert listed[0]["failure"]["error_type"] == "DataLeakageError"


@pytest.mark.asyncio
async def test_later_data_cannot_change_a_frozen_forecast_but_does_change_the_outcome(
    async_client: AsyncClient, db_session: AsyncSession
):
    """The same cutoffs are run twice; between the runs an extreme price is loaded for the final month."""
    last = await seed_standard(db_session)
    first = await run(async_client, note="before the late record")
    await db_session.execute(
        text(
            "INSERT INTO purchase_records (material_id, supplier_id, purchase_date, quantity, unit_price, currency, recorded_at) "
            "VALUES ('V-TREND', 'SUP-V1', :d, 500, 5000, 'USD', now())"
        ),
        {"d": last},
    )
    await db_session.commit()
    second = await run(async_client, note="after the late record")

    def frozen(run_id: str):
        rows = db_session.execute(
            text(
                "SELECT material_id, cutoff, horizon_days, forecast_value, dataset_version, risk_score, alert "
                "FROM validation_cases WHERE run_id = :r ORDER BY 1, 2, 3"
            ),
            {"r": run_id},
        )
        return rows

    a = (await frozen(first["run_id"])).all()
    b = (await frozen(second["run_id"])).all()
    assert len(a) == len(b) > 0
    assert [tuple(r) for r in a] == [
        tuple(r) for r in b
    ]  # every frozen forecast and signal is identical

    def actuals(run_id: str):
        return db_session.execute(
            text(
                "SELECT c.cutoff, (o.metrics->>'actual_value')::float FROM validation_outcomes o "
                "JOIN validation_cases c USING (case_id) WHERE o.run_id = :r AND c.material_id = 'V-TREND' "
                "AND c.horizon_days = 30 AND o.status = 'evaluated' ORDER BY 1"
            ),
            {"r": run_id},
        )

    before = {r[0]: r[1] for r in (await actuals(first["run_id"])).all()}
    after = {r[0]: r[1] for r in (await actuals(second["run_id"])).all()}
    changed = [c for c in before if before[c] != after[c]]
    assert changed == [month_end_of(2025, 11)]  # only the holdout that the late record falls into


# ── Protocol steps ───────────────────────────────────────────────────────────


def test_cutoffs_depend_only_on_the_data_span_and_the_settings():
    cutoffs, last_complete = validation.cutoff_schedule(
        date(2023, 7, 1), month_end_of(2025, 12), CFG
    )
    # 13 months of history are needed for the 30-day horizon: the first cutoff is July 2024
    assert cutoffs[0] == month_end_of(2024, 7) and cutoffs[-1] == month_end_of(2025, 11)
    assert last_complete == date(2025, 12, 1) and len(cutoffs) == 17
    # an unfinished final month is not a holdout month: the last cutoff moves back
    partial, last_complete = validation.cutoff_schedule(date(2023, 7, 1), date(2025, 12, 15), CFG)
    assert partial[-1] == month_end_of(2025, 10) and last_complete == date(2025, 11, 1)
    stepped, _ = validation.cutoff_schedule(
        date(2023, 7, 1), month_end_of(2025, 12), ValidationConfig(cutoff_step_months=3)
    )
    assert stepped == [
        month_end_of(2024, 7),
        month_end_of(2024, 10),
        month_end_of(2025, 1),
        month_end_of(2025, 4),
        month_end_of(2025, 7),
        month_end_of(2025, 10),
    ]


@pytest.mark.asyncio
async def test_every_forecast_is_stored_before_any_actual_is_read(
    async_client: AsyncClient, db_session: AsyncSession, monkeypatch
):
    await seed_standard(db_session)
    seen: dict = {}
    real = validation.reveal_actuals

    async def spy(session, cases, dataset_id, data_end):
        seen["cases"] = await count(session, "validation_cases")
        seen["frozen"] = len(cases)
        seen["outcomes"] = await count(session, "validation_outcomes")
        seen["summaries"] = await count(session, "validation_summaries")
        return await real(session, cases, dataset_id, data_end)

    monkeypatch.setattr(validation, "reveal_actuals", spy)
    data = await run(async_client)
    assert (
        seen["frozen"] > 0 and seen["cases"] >= seen["frozen"]
    )  # every case was already in the database
    assert seen["outcomes"] == 0 and seen["summaries"] == 0  # and nothing had been judged yet
    assert data["metrics"]["cases"] == seen["cases"]
    order = (
        await db_session.execute(
            text(
                "SELECT max(c.frozen_at) < min(o.revealed_at) FROM validation_cases c, validation_outcomes o"
            )
        )
    ).scalar_one()
    assert order is True  # the last forecast was frozen before the first actual was revealed


@pytest.mark.asyncio
async def test_a_frozen_forecast_can_be_reproduced_from_the_data_before_its_cutoff(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)
    data = await run(async_client, horizons_days=[30])
    case = (
        await async_client.get(
            f"{RUNS}/{data['run_id']}/cases", params={"kind": "evaluated", "limit": 500}
        )
    ).json()["data"]["items"][5]
    materials, _ = await validation.loader.load_material_data(
        db_session, date.fromisoformat(case["cutoff"]), None
    )
    mat = next(m for m in materials if m.material_id == case["material_id"])
    currency, points, _ = validation.monthly_history(mat, date.fromisoformat(case["cutoff"]))
    again = forecast_engine.run_horizon(points, date.fromisoformat(case["cutoff"]), 30, currency)
    assert again.point.value == pytest.approx(case["forecast_value"], abs=1e-9)
    assert case["last_observed_price"] == pytest.approx(points[-1].price)


@pytest.mark.asyncio
async def test_a_full_run_stores_every_case_with_an_outcome_or_a_reason(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)
    data = await run(async_client, note="full run")
    assert data["status"] == "completed" and data["versions"]["validation_method"] == METHOD_VERSION
    assert (
        data["config"]["alert_threshold"] == 50
    )  # the High band of the active weights, resolved and stored
    cases = data["metrics"]["cases"]
    assert cases == 2 * 17 * 2  # materials x cutoffs x horizons: nothing is skipped silently
    assert await count(db_session, "validation_cases") == cases
    by_status = dict(
        (
            await db_session.execute(
                text("SELECT status, count(*) FROM validation_cases GROUP BY 1")
            )
        ).all()
    )
    assert (
        by_status["withheld"] == 4
    )  # the 90-day horizon needs 15 months: two early cutoffs per material
    frozen = by_status["frozen"]
    assert await count(db_session, "validation_outcomes") == frozen  # every frozen case was judged
    not_evaluable = (
        await db_session.execute(
            text(
                "SELECT count(*) FROM validation_outcomes WHERE status = 'not_evaluable' AND reason IS NOT NULL"
            )
        )
    ).scalar_one()
    assert not_evaluable == 4  # the last two cutoffs' 90-day holdout months are not in the data yet
    problems = data["problems"]["not_forecast_or_evaluated"]
    assert sum(problems.values()) == 8 and all(
        k.startswith(("withheld", "not evaluable")) for k in problems
    )
    assert data["limitations"] and "synthetic" in " ".join(data["limitations"])
    for days, horizon in data["metrics"]["by_horizon"].items():  # unscored cases are counted
        listed = (
            await async_client.get(
                f"{RUNS}/{data['run_id']}/cases", params={"kind": "evaluated", "limit": 500}
            )
        ).json()["data"]["items"]
        unscored = [i for i in listed if i["horizon_days"] == int(days) and i["risk_score"] is None]
        assert horizon["warning"]["unscored"] == len(unscored)
        assert horizon["warning"]["unscored_events"] <= horizon["warning"]["unscored"]


@pytest.mark.asyncio
async def test_outcome_metrics_match_an_independent_calculation(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)
    data = await run(async_client, horizons_days=[30])
    items = (
        await async_client.get(
            f"{RUNS}/{data['run_id']}/cases", params={"kind": "evaluated", "limit": 500}
        )
    ).json()["data"]["items"]
    assert len(items) == 2 * 17
    target = next(i for i in items if i["material_id"] == "V-TREND" and i["cutoff"] == "2025-05-31")
    month = target["target_month"]
    actual = (
        await db_session.execute(
            text(
                "SELECT sum(quantity * unit_price) / sum(quantity) FROM purchase_records WHERE material_id = 'V-TREND' AND date_trunc('month', purchase_date)::date = CAST(:m AS date)"
            ),
            {"m": month},
        )
    ).scalar_one()
    o = target["outcome"]
    assert o["actual_value"] == pytest.approx(actual) and o["error"] == pytest.approx(
        target["forecast_value"] - actual
    )
    assert o["abs_error"] == pytest.approx(abs(target["forecast_value"] - actual))
    assert o["pct_error"] == pytest.approx(abs(target["forecast_value"] - actual) / actual * 100)
    assert o["naive_abs_error"] == pytest.approx(abs(target["last_observed_price"] - actual))
    h = data["metrics"]["by_horizon"]["30"]
    abs_errors = [i["outcome"]["abs_error"] for i in items]
    assert h["forecast"]["mae"] == pytest.approx(sum(abs_errors) / len(abs_errors))
    assert h["forecast"]["n"] == len(items) and h["evaluated"] == len(items)


@pytest.mark.asyncio
async def test_the_same_cases_are_run_whatever_the_results(
    async_client: AsyncClient, db_session: AsyncSession
):
    """No cherry-picking: the cutoffs and cases do not depend on how well anything did."""
    await seed_standard(db_session)
    strict = await run(async_client, alert_threshold=90, note="very high bar")
    loose = await run(async_client, alert_threshold=1, note="very low bar")
    keys = {}
    for r in (strict, loose):
        rows = (
            await db_session.execute(
                text(
                    "SELECT material_id, cutoff, horizon_days FROM validation_cases WHERE run_id = :r ORDER BY 1,2,3"
                ),
                {"r": r["run_id"]},
            )
        ).all()
        keys[r["run_id"]] = [tuple(x) for x in rows]
    assert keys[strict["run_id"]] == keys[loose["run_id"]]
    strict_w, loose_w = (
        strict["metrics"]["by_horizon"]["30"]["warning"],
        loose["metrics"]["by_horizon"]["30"]["warning"],
    )
    # only the warning changes, never the cases
    assert strict_w["alerts"] < loose_w["alerts"] and strict_w["n"] == loose_w["n"]
    assert (
        strict["metrics"]["by_horizon"]["30"]["forecast"]
        == loose["metrics"]["by_horizon"]["30"]["forecast"]
    )
    assert len({r["run_id"] for r in await validation.list_runs(db_session)}) == 2  # both kept


@pytest.mark.asyncio
async def test_false_alarms_and_misses_are_listed_not_hidden(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)
    data = await run(
        async_client, alert_threshold=1
    )  # a hair-trigger warning: plenty of false alarms
    warn = data["metrics"]["by_horizon"]["30"]["warning"]
    problems = data["problems"]
    assert warn["fp"] > 0 and warn["fn"] >= 0
    listed_fp = [p for p in problems["false_positives"] if p["horizon_days"] == 30]
    listed_fn = [p for p in problems["false_negatives"] if p["horizon_days"] == 30]
    assert len(listed_fp) == warn["fp"] and len(listed_fn) == warn["fn"]  # the lists are the counts
    stored_fp = await async_client.get(
        f"{RUNS}/{data['run_id']}/cases", params={"kind": "false_positives", "limit": 500}
    )
    assert stored_fp.json()["data"]["total"] == len(problems["false_positives"])
    spike_miss = await run(
        async_client, alert_threshold=99, material_ids=["V-SPIKE"], horizons_days=[30]
    )
    assert (
        spike_miss["metrics"]["by_horizon"]["30"]["warning"]["fn"] >= 1
    )  # the unforeseeable jump is a miss
    assert spike_miss["metrics"]["by_horizon"]["30"]["warning"]["recall"] == 0


# ── Metrics, calculated by hand ──────────────────────────────────────────────


def case(forecast: float, last: float = 100.0, alert: bool = False) -> FrozenCase:
    return FrozenCase(
        "M",
        date(2025, 1, 31),
        30,
        "frozen",
        last_observed_price=last,
        forecast_value=forecast,
        naive_value=last,
        alert=alert,
    )


def test_error_metrics_are_hand_calculated():
    cfg = ValidationConfig()
    rows = [
        metrics.evaluate_case(case(110), 100, cfg),
        metrics.evaluate_case(case(90), 100, cfg),
        metrics.evaluate_case(case(105), 120, cfg),
    ]
    # errors: +10, -10, -15 -> absolute 10, 10, 15
    m = metrics.error_metrics(rows)
    assert m["n"] == 3 and m["mae"] == pytest.approx(35 / 3)
    assert m["rmse"] == pytest.approx(((100 + 100 + 225) / 3) ** 0.5)
    assert m["mape_pct"] == pytest.approx((10 / 100 + 10 / 100 + 15 / 120) / 3 * 100)
    # the naive forecast ("100") misses by 0, 0 and 20: the model is worse on the first two cases
    assert m["naive_mae"] == pytest.approx(20 / 3) and m["beats_naive_share"] == pytest.approx(
        1 / 3
    )
    assert m["mae_vs_naive_pct"] == pytest.approx((35 / 20 - 1) * 100)


def test_directional_accuracy_ignores_flat_moves_and_counts_wrong_ones():
    cfg = ValidationConfig(flat_band_pct=0.5)
    up_right = metrics.evaluate_case(case(105), 110, cfg)  # forecast up, actual up
    down_wrong = metrics.evaluate_case(case(95), 108, cfg)  # forecast down, actual up
    flat_actual = metrics.evaluate_case(
        case(105), 100.2, cfg
    )  # the actual barely moved: not scored
    assert [r["direction_correct"] for r in (up_right, down_wrong, flat_actual)] == [
        True,
        False,
        None,
    ]
    m = metrics.error_metrics([up_right, down_wrong, flat_actual])
    assert m["directional_n"] == 2 and m["directional_accuracy"] == 0.5


def test_a_flat_forecast_makes_no_directional_call_and_is_counted_apart():
    """Method 1.1: 'the price will stay the same' is not a wrong direction when the price moves."""
    cfg = ValidationConfig(flat_band_pct=0.5)
    no_call = metrics.evaluate_case(case(100.1), 110, cfg)  # forecast flat, actual up
    both_flat = metrics.evaluate_case(case(100.1), 100.2, cfg)
    right = metrics.evaluate_case(case(106), 110, cfg)
    wrong = metrics.evaluate_case(case(94), 110, cfg)
    assert [r["direction_correct"] for r in (no_call, both_flat, right, wrong)] == [
        None,
        None,
        True,
        False,
    ]
    assert [r["direction_no_call"] for r in (no_call, both_flat, right, wrong)] == [
        True,
        False,
        False,
        False,
    ]
    m = metrics.error_metrics([no_call, both_flat, right, wrong])
    assert (
        m["directional_n"] == 2
        and m["directional_accuracy"] == 0.5
        and m["directional_no_call_n"] == 1
    )


def test_comparison_with_the_naive_forecast_reports_beats_ties_and_worse():
    cfg = ValidationConfig()
    same_as_naive = metrics.evaluate_case(
        case(100), 110, cfg
    )  # forecast = last: exactly the naive error
    better = metrics.evaluate_case(case(108), 110, cfg)
    worse = metrics.evaluate_case(case(90), 110, cfg)
    m = metrics.error_metrics([same_as_naive, better, worse])
    assert (
        m["beats_naive_share"],
        m["ties_naive_share"],
        m["worse_than_naive_share"],
    ) == pytest.approx((1 / 3, 1 / 3, 1 / 3))
    assert m["ties_naive"] == 1


def test_warning_quality_counts_and_rates():
    classes = ["TP", "TP", "TP", "FP", "FP", "FN", "TN", "TN", "TN", "TN"]
    c = metrics.confusion_metrics(classes)
    assert (c["tp"], c["fp"], c["fn"], c["tn"], c["events"], c["alerts"]) == (3, 2, 1, 4, 4, 5)
    assert c["precision"] == pytest.approx(3 / 5) and c["recall"] == pytest.approx(3 / 4)
    assert c["false_positive_rate"] == pytest.approx(2 / 6) and c[
        "false_negative_rate"
    ] == pytest.approx(1 / 4)
    assert c["event_rate"] == pytest.approx(0.4)
    none = metrics.confusion_metrics(
        ["TN", "TN"]
    )  # no events and no alerts: the rates are not defined
    assert none["precision"] is None and none["recall"] is None and none["false_positive_rate"] == 0
    assert [
        metrics.classify(a, e)
        for a, e in ((True, True), (True, False), (False, True), (False, False))
    ] == ["TP", "FP", "FN", "TN"]


def row(cutoff: date, target: date, alert: bool, event: bool) -> dict:
    return {"cutoff": cutoff, "target_month": target, "alert": alert, "event": event}


def test_advance_warning_is_measured_from_the_start_of_an_unbroken_run_of_alerts():
    jan, feb, mar, apr = (month_end_of(2025, m) for m in (1, 2, 3, 4))
    rows = [
        row(jan, date(2025, 2, 1), False, False),
        row(feb, date(2025, 3, 1), True, False),
        row(mar, date(2025, 4, 1), True, True),  # warned since February: 2 months ahead of April
        row(apr, date(2025, 5, 1), True, True),  # still the same run: 3 months ahead of May
    ]
    assert metrics.lead_times(rows, 1) == [2, 3]
    broken = [
        row(jan, date(2025, 2, 1), True, False),
        row(feb, date(2025, 3, 1), False, False),
        row(mar, date(2025, 4, 1), True, True),
    ]  # the alert stopped in February: a new run starts in March
    assert metrics.lead_times(broken, 1) == [1]
    missed = [row(jan, date(2025, 2, 1), False, True)]
    assert metrics.lead_times(missed, 1) == [] and metrics.lead_time_summary([2, 3, 4]) == {
        "n": 3,
        "mean_months": 3,
        "median_months": 3,
        "min_months": 2,
        "max_months": 4,
    }


# ── Failed runs are kept; roles; inputs ──────────────────────────────────────


@pytest.mark.asyncio
async def test_runs_cases_outcomes_and_summaries_can_never_be_changed_or_deleted(
    async_client: AsyncClient, db_session: AsyncSession
):
    from app.api.db.triggers import VALIDATION_IMMUTABILITY_SQL

    await db_session.execute(text(VALIDATION_IMMUTABILITY_SQL))  # as the migration does
    await db_session.commit()
    await seed_standard(db_session)
    stored = await run(async_client)
    await db_session.execute(
        text(
            "INSERT INTO validation_failures (failure_id, run_id, error_type, message, recorded_at) "
            "VALUES ('VFL-T', :r, 'DataLeakageError', 'stopped', now())"
        ),
        {"r": stored["run_id"]},
    )
    await db_session.commit()
    for statement in (
        "UPDATE validation_runs SET note = 'edited'",
        "DELETE FROM validation_runs",
        "UPDATE validation_cases SET forecast_value = 1",
        "DELETE FROM validation_cases",
        "UPDATE validation_outcomes SET status = 'evaluated'",
        "DELETE FROM validation_outcomes",
        "UPDATE validation_summaries SET limitations = '[]'",
        "DELETE FROM validation_summaries",
        "UPDATE validation_failures SET message = 'edited'",
        "DELETE FROM validation_failures",
    ):
        with pytest.raises(DBAPIError, match="immutable"):
            await db_session.execute(text(statement))
        await db_session.rollback()
    assert await count(db_session, "validation_runs") == 1


@pytest.mark.asyncio
async def test_validation_roles_and_inputs(
    async_client: AsyncClient, client_as, db_session: AsyncSession
):
    assert (await async_client.post(RUNS, json={})).status_code == 404  # no purchase history yet
    await seed_standard(db_session)
    for bad in (
        {"horizons_days": []},
        {"horizons_days": [7]},
        {"horizons_days": [0]},
        {"horizons_days": [1000]},
        {"cutoff_step_months": 0},
        {"event_threshold_pct": 0},
        {"alert_threshold": 150},
        {"unknown": 1},
    ):
        assert (await async_client.post(RUNS, json=bad)).status_code == 422, bad
    stored = await run(async_client, horizons_days=[30])
    assert (
        await async_client.get(f"{RUNS}/{stored['run_id']}/cases", params={"kind": "nope"})
    ).status_code == 422
    assert (await async_client.get(f"{RUNS}/VAL-NOPE")).status_code == 404
    for role, can_read, can_run in (
        ("admin", 200, 201),
        ("reviewer", 200, 201),
        ("read_only_reviewer", 200, 403),
        ("verifier", 403, 403),
        ("process_owner", 403, 403),
    ):
        who = make_principal("USR-ADMIN-001", f"v_{role}", role, role)
        async with client_as(who) as client:
            assert (await client.get(RUNS)).status_code == can_read, role
            assert (await client.get(f"{RUNS}/{stored['run_id']}")).status_code == can_read, role
            if can_run == 201:
                assert (
                    await client.post(
                        RUNS, json={"horizons_days": [30], "material_ids": ["V-TREND"]}
                    )
                ).status_code == 201
            else:
                assert (await client.post(RUNS, json={})).status_code == can_run, role


def test_a_naive_forecast_stored_with_rounding_is_a_tie_not_a_win_or_a_loss():
    """Found on real data: forecasts are rounded to 6 decimals, so 'same as last month' is off by ~1e-7."""
    cfg = ValidationConfig()
    rounded_naive = metrics.evaluate_case(
        case(100.0000004), 110, cfg
    )  # the naive forecast, as stored
    rounded_down = metrics.evaluate_case(case(99.9999996), 110, cfg)
    assert (
        metrics.versus_naive(rounded_naive["abs_error"], rounded_naive["naive_abs_error"]) == "ties"
    )
    assert (
        metrics.versus_naive(rounded_down["abs_error"], rounded_down["naive_abs_error"]) == "ties"
    )
    assert (
        metrics.versus_naive(9.0, 10.0) == "beats" and metrics.versus_naive(11.0, 10.0) == "worse"
    )
    m = metrics.error_metrics([rounded_naive, rounded_down])
    assert (
        m["ties_naive_share"] == 1
        and m["beats_naive_share"] == 0
        and m["worse_than_naive_share"] == 0
    )


@pytest.mark.asyncio
async def test_a_bom_line_starting_after_the_cutoff_is_never_loaded(db_session: AsyncSession):
    await seed_standard(db_session)
    db_session.add_all(
        [
            BOMEntry(
                product_sku="P-OLD",
                material_id="V-TREND",
                bom_quantity=1,
                unit_of_measure="kg",
                effective_from=date(2024, 1, 1),
            ),
            BOMEntry(
                product_sku="P-LATE",
                material_id="V-TREND",
                bom_quantity=1,
                unit_of_measure="kg",
                effective_from=date(2025, 5, 1),
            ),
        ]
    )
    await db_session.commit()
    cutoff = date(2025, 3, 31)
    _, bom = await validation.loader.load_material_data(db_session, cutoff, None)
    assert [b.product_sku for b in bom] == ["P-OLD"]  # the later line is not read at all
    # and if a line that starts later were ever handed over, the run would refuse it
    late = SimpleNamespace(effective_from=date(2025, 5, 1))
    with pytest.raises(DataLeakageError, match="bill-of-materials"):
        validation.assert_no_future_bom([late], cutoff)
    validation.assert_no_future_bom([SimpleNamespace(effective_from=None)], cutoff)


@pytest.mark.asyncio
async def test_a_zero_last_price_is_withheld_with_a_reason_not_a_crash(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_standard(db_session)
    await seed_series(db_session, "V-ZERO", [*trending(20), 0.0, *trending(9)])
    data = await run(async_client, horizons_days=[30])
    assert data["status"] == "completed"
    items = (
        await async_client.get(
            f"{RUNS}/{data['run_id']}/cases", params={"kind": "withheld", "limit": 500}
        )
    ).json()["data"]["items"]
    zero = [
        i
        for i in items
        if i["material_id"] == "V-ZERO" and "zero or below" in (i["withheld_reason"] or "")
    ]
    assert zero, "the case after a month priced at zero is withheld with that reason"
    assert any("zero or below" in k for k in data["problems"]["not_forecast_or_evaluated"])
