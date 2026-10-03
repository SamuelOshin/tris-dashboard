"""
Retrospective validation service (decision D5). The protocol, in the order it is carried out:

 1. Choose historical cutoffs from the configuration and the span of the data alone.
 2. For each cutoff, load only records dated on or before it. The date limit is applied in the
    database query, and every loaded record is checked again (`assert_no_future_records`).
 3. Fit the forecast and calculate the risk score from that data only.
 4. Forecast the holdout month.
 5. Freeze: store every forecast and signal and commit them BEFORE any later record is read.
 6. Reveal: only then read the holdout actuals (`reveal_actuals` is the one place that reads data
    after a cutoff), used for evaluation and never for fitting.
 7. Compare, then calculate the metrics.
 8. Store the summary with its limitations and problems. A run that stops early keeps its
    header and whatever it stored; nothing is ever deleted.
"""

from collections import defaultdict
from datetime import date
from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import DataLeakageError, NotFoundError
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.manufacturing.models import (
    PurchaseRecord,
    ValidationCase,
    ValidationFailure,
    ValidationOutcome,
    ValidationRun,
    ValidationSummary,
)
from app.api.modules.v1.manufacturing.service import analytics_loader as loader
from app.api.modules.v1.manufacturing.service import risk_factors as risk_factors
from app.api.modules.v1.manufacturing.service import risk_scoring_engine as scoring_engine
from app.api.modules.v1.manufacturing.service import risk_scoring_service as risk_service
from app.api.modules.v1.manufacturing.service import validation_metrics as metrics
from app.api.modules.v1.manufacturing.service.analytics_types import DEFAULT_CONFIG, MaterialData
from app.api.modules.v1.manufacturing.service.detection_engine import compute_results
from app.api.modules.v1.manufacturing.service.forecast_engine import (
    PRICE_NOT_POSITIVE_REASON,
    run_horizon,
)
from app.api.modules.v1.manufacturing.service.forecast_history import add_months
from app.api.modules.v1.manufacturing.service.forecast_service import monthly_history
from app.api.modules.v1.manufacturing.service.forecast_types import (
    DEFAULT_FORECAST_CONFIG,
    FORECAST,
)
from app.api.modules.v1.manufacturing.service.price_series import month_end
from app.api.modules.v1.manufacturing.service.risk_types import (
    METHOD_VERSION as RISK_METHOD_VERSION,
)
from app.api.modules.v1.manufacturing.service.risk_types import ForecastRef
from app.api.modules.v1.manufacturing.service.validation_types import (
    CASE_FROZEN,
    CASE_WITHHELD,
    METHOD_VERSION,
    OUTCOME_EVALUATED,
    OUTCOME_NOT_EVALUABLE,
    FrozenCase,
    ValidationConfig,
)

FORECAST_ENGINE_VERSION = "1.0"
CASE_KINDS = ("all", "false_positives", "false_negatives", "evaluated", "not_evaluable", "withheld")


def assert_no_future_records(data: MaterialData, cutoff: date) -> None:
    """
    Defence in depth for decision D5: the query layer already limits records to the cutoff; this
    refuses to go on if any loaded record carries a later business date.

    Raises:
        DataLeakageError: If a purchase, stock, cost, variance or supplier record is dated after
            the cutoff.
    """
    late = (
        [("purchase", p.purchase_date) for p in data.purchases]
        + [("stock", i.snapshot_date) for i in data.inventory]
        + [("standard cost", c.effective_from) for c in data.costs]
        + [("price variance", v.period_end) for v in data.variances]
        + [("supplier metric", o.metric_date) for o in data.ops]
    )
    leaked = [(kind, day) for kind, day in late if day > cutoff]
    if leaked:
        kind, day = min(leaked, key=lambda item: item[1])
        raise DataLeakageError(
            f"{len(leaked)} {kind}-type record(s) for {data.material_id} dated after the cutoff "
            f"{cutoff.isoformat()} were loaded (first: {day.isoformat()}). Data from after the "
            "cutoff must never be used to fit a model or calculate a score."
        )


def assert_no_future_bom(all_bom: list, cutoff: date) -> None:
    """
    Refuse a bill-of-materials line that only starts after the cutoff (it did not exist yet).

    Raises:
        DataLeakageError: If any BOM line has an effective-from date after the cutoff.
    """
    late = [b.effective_from for b in all_bom if b.effective_from and b.effective_from > cutoff]
    if late:
        raise DataLeakageError(
            f"{len(late)} bill-of-materials line(s) starting after the cutoff {cutoff.isoformat()} "
            f"were loaded (first: {min(late).isoformat()}). Data from after the cutoff must never "
            "be used to fit a model or calculate a score."
        )


def cutoff_schedule(
    first_purchase: date, data_end: date, cfg: ValidationConfig
) -> tuple[list[date], date]:
    """
    Month-end cutoffs, from the first date a forecast could have enough history to the last one
    whose shortest holdout month is complete. Depends only on the data span and the settings.

    Returns:
        The cutoffs, and the last complete month.
    """
    last_complete = (
        data_end.replace(day=1) if data_end == month_end(data_end) else add_months(data_end, -1)
    )
    shortest = min(DEFAULT_FORECAST_CONFIG.horizon_months(d) for d in cfg.horizons_days)
    required = DEFAULT_FORECAST_CONFIG.required_months(min(cfg.horizons_days))
    first = month_end(add_months(first_purchase, required - 1))
    cutoffs, month = [], first.replace(day=1)
    while add_months(month, shortest) <= last_complete:
        cutoffs.append(month_end(month))
        month = add_months(month, cfg.cutoff_step_months)
    return cutoffs, last_complete


def _risk_signal(
    result,
    forecast_change_pct: float,
    horizon: int,
    series: list,
    all_bom: list,
    price_of: dict,
    currency_of: dict,
    cutoff: date,
    weights: dict,
    alert_threshold: float,
) -> tuple[float | None, str | None, bool, list[dict]]:
    """The risk score at the cutoff, using the forecast made at the cutoff (never a later one)."""
    readings = risk_factors.read_all(
        result.material_id,
        result.metrics,
        series,
        ForecastRef("validation", horizon, forecast_change_pct),
        all_bom,
        price_of,
        currency_of,
        cutoff,
    )
    outcome = scoring_engine.score_material(readings, weights)
    if outcome["status"] != "scored":
        return None, None, False, []
    factors = [
        {k: f[k] for k in ("code", "value", "sub_score", "points", "status")}
        for f in outcome["factors"]
    ]
    return outcome["score"], outcome["level"], outcome["score"] >= alert_threshold, factors


def freeze_cutoff(
    materials: list[MaterialData],
    results: list,
    all_bom: list,
    cutoff: date,
    cfg: ValidationConfig,
    weights: dict,
    alert_threshold: float,
) -> list[FrozenCase]:
    """
    Make the forecast and risk signal for every material at one cutoff, from the records given.

    Raises:
        DataLeakageError: If any record or monthly point is dated after the cutoff.
    """
    assert_no_future_bom(all_bom, cutoff)
    by_id = {r.material_id: r for r in results}
    price_of = {r.material_id: r.metrics.get("latest_price") for r in results}
    currency_of = {r.material_id: r.currency for r in results}
    cases: list[FrozenCase] = []
    for data in materials:
        if cfg.material_ids and data.material_id not in cfg.material_ids:
            continue
        assert_no_future_records(data, cutoff)
        currency, points, _ = monthly_history(data, cutoff)
        if not points:
            continue
        for horizon in cfg.horizons_days:
            outcome = run_horizon(points, cutoff, horizon, currency)  # also checks for leakage
            base = FrozenCase(data.material_id, cutoff, horizon, CASE_WITHHELD, currency=currency)
            if outcome.status != FORECAST:
                base.withheld_reason = outcome.reason
                cases.append(base)
                continue
            last = points[-1].price
            final = outcome.point
            change = (final.value / last - 1) * 100
            score, level, alert, factors = _risk_signal(
                by_id[data.material_id],
                change,
                horizon,
                points,
                all_bom,
                price_of,
                currency_of,
                cutoff,
                weights,
                alert_threshold,
            )
            base.status = CASE_FROZEN
            base.target_month = final.month
            base.last_observed_price = last
            base.forecast_value = final.value
            base.lower_bound, base.upper_bound = final.lower, final.upper
            base.naive_value = last
            base.model_code, base.model_name = outcome.model_code, outcome.model_name
            base.model_version, base.dataset_version = (
                outcome.model_version,
                outcome.dataset_version,
            )
            base.history_months = outcome.available_months
            base.risk_score, base.risk_level, base.alert, base.risk_factors = (
                score,
                level,
                alert,
                factors,
            )
            cases.append(base)
    return cases


async def reveal_actuals(
    session: AsyncSession, cases: list[ValidationCase], dataset_id: str | None, data_end: date
) -> dict[tuple[str, date, str], float]:
    """
    Read the holdout actuals. This is the only place validation reads records dated after a
    cutoff, and it is only called once every forecast has been stored.

    Returns:
        The quantity-weighted monthly average price per (material, month, currency) for complete
        months up to the end of the data.
    """
    if not cases:
        return {}
    start = min(c.target_month for c in cases if c.target_month)
    stmt = select(PurchaseRecord).where(
        PurchaseRecord.purchase_date >= start, PurchaseRecord.purchase_date <= data_end
    )
    if dataset_id:
        stmt = stmt.where(PurchaseRecord.dataset_id == dataset_id)
    spend: dict[tuple[str, date, str], list[float]] = defaultdict(lambda: [0.0, 0.0])
    for p in (await session.execute(stmt)).scalars():
        key = (p.material_id, p.purchase_date.replace(day=1), p.currency)
        spend[key][0] += p.quantity * p.unit_price
        spend[key][1] += p.quantity
    return {k: s / q for k, (s, q) in spend.items() if q > 0}


def _case_row(case: ValidationCase, outcome: ValidationOutcome | None) -> dict[str, Any]:
    row: dict[str, Any] = {
        "case_id": case.case_id,
        "material_id": case.material_id,
        "cutoff": case.cutoff,
        "horizon_days": case.horizon_days,
        "status": case.status,
        "target_month": case.target_month,
        "model_name": case.model_name,
        "alert": case.alert,
        "scored": case.risk_score is not None,
        "outcome_status": outcome.status if outcome else None,
    }
    if outcome and outcome.status == OUTCOME_EVALUATED:
        row.update(outcome.metrics)
        row["classification"] = outcome.classification
    return row


async def run_validation(
    session: AsyncSession, user: User, cfg: ValidationConfig, note: str | None = None
) -> dict[str, Any]:
    """
    Run the retrospective validation protocol over every material and cutoff the data allows.

    Raises:
        NotFoundError: If there is no purchase history.
        DataLeakageError: If the data layer returns anything dated after a cutoff (the run's
            header and any stored cases are kept).
    """
    data_end = await loader.latest_purchase_date(session, cfg.dataset_id)
    first = await loader.earliest_purchase_date(session, cfg.dataset_id)
    if data_end is None or first is None:
        raise NotFoundError("No purchase history has been loaded yet.")
    weight_set = await risk_service.active_weight_set(session)
    threshold = (
        cfg.alert_threshold
        if cfg.alert_threshold is not None
        else float(weight_set.config["bands"]["high"])
    )
    cutoffs, last_complete = cutoff_schedule(first, data_end, cfg)
    resolved = {**cfg.to_dict(), "alert_threshold": threshold}

    run = ValidationRun(
        run_id=f"VAL-{uuid4().hex[:10].upper()}",
        dataset_id=cfg.dataset_id,
        data_end=data_end,
        config={
            **resolved,
            "cutoffs": [c.isoformat() for c in cutoffs],
            "last_complete_month": last_complete.isoformat(),
        },
        versions={
            "validation_method": METHOD_VERSION,
            "forecast_engine": FORECAST_ENGINE_VERSION,
            "risk_method": RISK_METHOD_VERSION,
            "risk_weight_version": weight_set.version,
        },
        note=note,
        created_by=user.user_id,
    )
    session.add(run)
    await session.commit()  # the header is kept even if the run stops early
    run_id = run.run_id
    try:
        return await _run_protocol(session, run, cfg, cutoffs, last_complete, weight_set, threshold)
    except Exception as exc:
        # Not swallowed: the cause is stored with the run (insert-only), then the error goes on.
        await _record_failure(session, run_id, exc)
        raise


async def _record_failure(session: AsyncSession, run_id: str, exc: Exception) -> None:
    """Keep why a run stopped, next to whatever it had already stored."""
    await session.rollback()
    session.add(
        ValidationFailure(
            failure_id=f"VFL-{uuid4().hex[:12].upper()}",
            run_id=run_id,
            error_type=type(exc).__name__,
            message=str(exc)[:1000] or type(exc).__name__,
        )
    )
    await session.commit()


async def _run_protocol(
    session: AsyncSession,
    run: ValidationRun,
    cfg: ValidationConfig,
    cutoffs: list[date],
    last_complete: date,
    weight_set: Any,
    threshold: float,
) -> dict[str, Any]:
    """Freeze every forecast and signal, then reveal the actuals, judge and summarise."""
    # Freeze: every forecast and signal is stored before any actual is read.
    stored: list[ValidationCase] = []
    for cutoff in cutoffs:
        materials, all_bom = await loader.load_material_data(session, cutoff, cfg.dataset_id)
        results = compute_results(materials, all_bom, cutoff, DEFAULT_CONFIG)
        for frozen in freeze_cutoff(
            materials, results, all_bom, cutoff, cfg, weight_set.config, threshold
        ):
            row = ValidationCase(
                case_id=f"VCS-{uuid4().hex[:12].upper()}", run_id=run.run_id, **vars(frozen)
            )
            session.add(row)
            stored.append(row)
        await session.commit()

    # Reveal: only now are records after the cutoffs read.
    actuals = await reveal_actuals(
        session, [c for c in stored if c.status == CASE_FROZEN], cfg.dataset_id, run.data_end
    )
    outcomes: list[ValidationOutcome] = []
    for case in (c for c in stored if c.status == CASE_FROZEN):
        outcomes.append(_outcome(case, actuals, last_complete, cfg, run.run_id))
    session.add_all(outcomes)
    await session.commit()

    by_case = {o.case_id: o for o in outcomes}
    rows = [_case_row(c, by_case.get(c.case_id)) for c in stored]
    summary = _summary(run, rows, cfg, outcomes, stored)
    session.add(summary)
    await session.commit()
    return await get_run(session, run.run_id)


def _outcome(
    case: ValidationCase,
    actuals: dict[tuple[str, date, str], float],
    last_complete: date,
    cfg: ValidationConfig,
    run_id: str,
) -> ValidationOutcome:
    base = {
        "outcome_id": f"VOC-{uuid4().hex[:12].upper()}",
        "case_id": case.case_id,
        "run_id": run_id,
    }
    if case.target_month > last_complete:
        return ValidationOutcome(
            **base,
            status=OUTCOME_NOT_EVALUABLE,
            metrics={},
            reason="The holdout month is not complete in the data.",
        )
    actual = actuals.get((case.material_id, case.target_month, case.currency))
    if actual is None:
        return ValidationOutcome(
            **base,
            status=OUTCOME_NOT_EVALUABLE,
            metrics={},
            reason="No purchases were recorded for the material in the holdout month.",
        )
    frozen = FrozenCase(
        case.material_id,
        case.cutoff,
        case.horizon_days,
        case.status,
        last_observed_price=case.last_observed_price,
        forecast_value=case.forecast_value,
        naive_value=case.naive_value,
        alert=case.alert,
    )
    result = metrics.evaluate_case(frozen, actual, cfg)
    return ValidationOutcome(
        **base, status=OUTCOME_EVALUATED, metrics=result, classification=result["classification"]
    )


def _limitations(cfg: ValidationConfig, evaluated: int) -> list[str]:
    notes = [
        f"Cutoffs are every {cfg.cutoff_step_months} month(s); neighbouring cutoffs and the 90-day "
        "horizon share most of their history and holdout months, so the cases are not "
        "independent and the number of cases overstates how much evidence there is.",
        "The risk signal is judged against a rise in the monthly average purchase price of at "
        f"least {cfg.event_threshold_pct:g}%. That is a definition chosen before the run, not "
        "the only reasonable one.",
        "Monthly averages of purchase prices, not daily prices; a forecast cannot be judged "
        "within a month.",
        "MAE and RMSE are in each material's own price units, so the pooled values mix scales "
        "and are dominated by high-priced materials; MAPE and the share of cases that beat the "
        "naive forecast are the comparable figures, and the per-material table gives each MAE "
        "on its own.",
        "Weights, scales and the warning threshold are judgement, not fitted; changing them "
        "changes the false positive and false negative counts.",
        "The data is synthetic: these results show that the method works as built, not how it "
        "would perform on a real company's purchasing.",
    ]
    if evaluated < 30:
        notes.append(
            f"Only {evaluated} case(s) were evaluated. That is too few for rates such as "
            "precision or recall to be more than indicative."
        )
    return notes


def _summary(
    run: ValidationRun,
    rows: list[dict],
    cfg: ValidationConfig,
    outcomes: list[ValidationOutcome],
    cases: list[ValidationCase],
) -> ValidationSummary:
    evaluated = [o for o in outcomes if o.status == OUTCOME_EVALUATED]
    reasons: dict[str, int] = defaultdict(int)
    for c in cases:
        if c.status == CASE_WITHHELD:
            label = (
                f"withheld: {PRICE_NOT_POSITIVE_REASON}"
                if c.withheld_reason == PRICE_NOT_POSITIVE_REASON
                else f"withheld: not enough history for the {c.horizon_days}-day outlook"
            )
            reasons[label] += 1
    for o in outcomes:
        if o.status == OUTCOME_NOT_EVALUABLE:
            reasons[f"not evaluable: {o.reason}"] += 1
    case_by_id = {c.case_id: c for c in cases}
    worse_than_naive = [
        o.case_id
        for o in evaluated
        if metrics.versus_naive(o.metrics["abs_error"], o.metrics["naive_abs_error"])
        == metrics.WORSE
    ]

    def listing(kind: str) -> list[dict[str, Any]]:
        return [
            {
                "case_id": o.case_id,
                "material_id": case_by_id[o.case_id].material_id,
                "cutoff": case_by_id[o.case_id].cutoff.isoformat(),
                "horizon_days": case_by_id[o.case_id].horizon_days,
                "risk_score": case_by_id[o.case_id].risk_score,
                "forecast_change_pct": o.metrics["forecast_change_pct"],
                "actual_change_pct": o.metrics["actual_change_pct"],
            }
            for o in evaluated
            if o.classification == kind
        ]

    return ValidationSummary(
        run_id=run.run_id,
        metrics={
            "by_horizon": metrics.summarise(rows, cfg),
            "cases": len(cases),
            "frozen": sum(1 for c in cases if c.status == CASE_FROZEN),
            "evaluated": len(evaluated),
        },
        limitations=_limitations(cfg, len(evaluated)),
        problems={
            "not_forecast_or_evaluated": dict(reasons),
            "worse_than_naive_cases": len(worse_than_naive),
            "false_positives": listing("FP"),
            "false_negatives": listing("FN"),
        },
    )


# ── Reading stored runs ──────────────────────────────────────────────────────


def _run_dto(
    run: ValidationRun, summary: ValidationSummary | None, failure: ValidationFailure | None = None
) -> dict[str, Any]:
    return {
        "run_id": run.run_id,
        "status": "completed" if summary else "incomplete",
        "created_at": run.created_at.isoformat(),
        "created_by": run.created_by,
        "dataset_id": run.dataset_id,
        "data_end": run.data_end.isoformat(),
        "note": run.note,
        "config": run.config,
        "versions": run.versions,
        "completed_at": summary.completed_at.isoformat() if summary else None,
        "failure": None
        if failure is None
        else {
            "error_type": failure.error_type,
            "message": failure.message,
            "recorded_at": failure.recorded_at.isoformat(),
        },
    }


async def list_runs(session: AsyncSession, limit: int = 50) -> list[dict[str, Any]]:
    """Every run, newest first, including runs that did not finish."""
    runs = (
        (
            await session.execute(
                select(ValidationRun).order_by(ValidationRun.created_at.desc()).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    summaries = {s.run_id: s for s in (await session.execute(select(ValidationSummary))).scalars()}
    failures = {f.run_id: f for f in (await session.execute(select(ValidationFailure))).scalars()}
    out = []
    for r in runs:
        s = summaries.get(r.run_id)
        dto = _run_dto(r, s, failures.get(r.run_id))
        dto["cases"] = s.metrics["cases"] if s else None
        dto["evaluated"] = s.metrics["evaluated"] if s else None
        out.append(dto)
    return out


async def get_run(session: AsyncSession, run_id: str) -> dict[str, Any]:
    """A run with its metrics, limitations and the problems found (false alarms, misses, gaps)."""
    run = await session.get(ValidationRun, run_id)
    if run is None:
        raise NotFoundError(f"Validation run '{run_id}' was not found.")
    summary = await session.get(ValidationSummary, run_id)
    failure = (
        (await session.execute(select(ValidationFailure).where(ValidationFailure.run_id == run_id)))
        .scalars()
        .first()
    )
    dto = _run_dto(run, summary, failure)
    dto["metrics"] = summary.metrics if summary else None
    dto["limitations"] = summary.limitations if summary else []
    dto["problems"] = summary.problems if summary else None
    return dto


async def list_cases(
    session: AsyncSession, run_id: str, kind: str = "all", limit: int = 100, offset: int = 0
) -> dict[str, Any]:
    """The stored cases of a run with their outcomes, optionally only one kind."""
    if await session.get(ValidationRun, run_id) is None:
        raise NotFoundError(f"Validation run '{run_id}' was not found.")
    cases = (
        (
            await session.execute(
                select(ValidationCase)
                .where(ValidationCase.run_id == run_id)
                .order_by(
                    ValidationCase.material_id, ValidationCase.cutoff, ValidationCase.horizon_days
                )
            )
        )
        .scalars()
        .all()
    )
    outcomes = {
        o.case_id: o
        for o in (
            await session.execute(
                select(ValidationOutcome).where(ValidationOutcome.run_id == run_id)
            )
        ).scalars()
    }

    def keep(c: ValidationCase) -> bool:
        o = outcomes.get(c.case_id)
        return {
            "all": True,
            "withheld": c.status == CASE_WITHHELD,
            "evaluated": bool(o and o.status == OUTCOME_EVALUATED),
            "not_evaluable": bool(o and o.status == OUTCOME_NOT_EVALUABLE),
            "false_positives": bool(o and o.classification == "FP"),
            "false_negatives": bool(o and o.classification == "FN"),
        }[kind]

    chosen = [c for c in cases if keep(c)]
    items = []
    for c in chosen[offset : offset + limit]:
        o = outcomes.get(c.case_id)
        items.append(
            {
                "case_id": c.case_id,
                "material_id": c.material_id,
                "cutoff": c.cutoff.isoformat(),
                "horizon_days": c.horizon_days,
                "status": c.status,
                "withheld_reason": c.withheld_reason,
                "target_month": c.target_month.isoformat() if c.target_month else None,
                "currency": c.currency,
                "last_observed_price": c.last_observed_price,
                "forecast_value": c.forecast_value,
                "model": c.model_name,
                "risk_score": c.risk_score,
                "risk_level": c.risk_level,
                "alert": c.alert,
                "frozen_at": c.frozen_at.isoformat(),
                "outcome": None
                if o is None
                else {
                    "status": o.status,
                    "reason": o.reason,
                    "classification": o.classification,
                    "revealed_at": o.revealed_at.isoformat(),
                    **o.metrics,
                },
            }
        )
    return {"run_id": run_id, "kind": kind, "total": len(chosen), "items": items}
