"""
Forecast service: runs forecasts from stored purchase history, stores each result as an
immutable run, and reads them back. Pure business logic — raises domain exceptions directly.

The as-of date (cutoff) is applied in the database query through the shared analytics loader,
so data after it never reaches a model; the engine then checks again (decision D5).
"""

from datetime import UTC, date, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import NotFoundError
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.manufacturing.models import ForecastRun
from app.api.modules.v1.manufacturing.service import admin_audit as audit
from app.api.modules.v1.manufacturing.service import analytics_loader as loader
from app.api.modules.v1.manufacturing.service import model_settings_service as model_settings
from app.api.modules.v1.manufacturing.service.analytics_types import MaterialData, MonthPoint
from app.api.modules.v1.manufacturing.service.forecast_engine import run_horizon
from app.api.modules.v1.manufacturing.service.forecast_history import trailing_consecutive_run
from app.api.modules.v1.manufacturing.service.forecast_types import (
    DEFAULT_FORECAST_CONFIG,
    FORECAST,
    ForecastConfig,
    HorizonOutcome,
)
from app.api.modules.v1.manufacturing.service.price_series import (
    dominant_currency,
    month_end,
    monthly_series,
)

DATA_FREQUENCY = "monthly"


def monthly_history(
    data: MaterialData, cutoff: date
) -> tuple[str | None, list[MonthPoint], date | None]:
    """
    Monthly price history up to the cutoff, in the material's main currency.

    If the cutoff falls inside the last month of data, that month is incomplete and its average
    would be treated as a full observation, so it is left out and reported to the caller.
    """
    currency = dominant_currency(data.purchases)
    points = monthly_series([p for p in data.purchases if p.currency == currency])
    excluded = None
    if points and (points[-1].month.year, points[-1].month.month) == (cutoff.year, cutoff.month):
        if cutoff < month_end(points[-1].month):
            excluded, points = points[-1].month, points[:-1]
    return currency, points, excluded


def _require_purchases(data: MaterialData, cutoff: date, points: list[MonthPoint]) -> None:
    if not data.purchases:
        raise NotFoundError(f"Material '{data.material_id}' has no purchases up to {cutoff}.")
    if not points:
        raise NotFoundError(
            f"Material '{data.material_id}' has no complete month of purchases up to {cutoff}."
        )


async def _load(
    session: AsyncSession, material_id: str, as_of: date | None, dataset_id: str | None
) -> tuple[date, MaterialData]:
    cutoff = as_of or await loader.latest_purchase_date(session, dataset_id)
    if cutoff is None:
        raise NotFoundError("No purchase history has been loaded yet.")
    materials, _ = await loader.load_material_data(session, cutoff, dataset_id)
    data = next((m for m in materials if m.material_id == material_id), None)
    if data is None:
        raise NotFoundError(f"Material '{material_id}' was not found in the analysed data.")
    return cutoff, data


def _run_dto(run: ForecastRun) -> dict[str, Any]:
    last_price = run.config.get("last_observed_price")
    change = (run.forecast_value / last_price - 1) * 100 if last_price else None
    return {
        "run_id": run.run_id,
        "created_at": run.created_at.isoformat(),
        "created_by": run.created_by,
        "as_of": run.as_of.isoformat(),
        "dataset_id": run.dataset_id,
        "currency": run.currency,
        "horizon_days": run.horizon_days,
        "horizon_months": run.horizon_months,
        "model": {"code": run.model_code, "name": run.model_name, "version": run.model_version},
        "dataset_version": run.dataset_version,
        "history": {
            "months": run.history_months,
            "start": run.history_start.isoformat(),
            "end": run.history_end.isoformat(),
            "frequency": DATA_FREQUENCY,
        },
        "forecast": {
            "month": run.forecast_month.isoformat(),
            "value": run.forecast_value,
            "lower": run.lower_bound,
            "upper": run.upper_bound,
            "interval_level": run.interval_level,
            "last_observed_price": last_price,
            "change_pct": None if change is None else round(change, 2),
        },
        "path": run.path,
        "candidates": run.candidates,
        "selection_rationale": run.selection_rationale,
        "config": run.config,
    }


def _to_run(
    outcome: HorizonOutcome,
    user: User,
    material_id: str,
    dataset_id: str | None,
    currency: str | None,
    last_price: float,
) -> ForecastRun:
    final = outcome.point
    assert final is not None and outcome.history_start and outcome.history_end
    return ForecastRun(
        run_id=f"FRC-{uuid4().hex[:12]}",
        material_id=material_id,
        dataset_id=dataset_id,
        as_of=outcome.cutoff,
        currency=currency,
        horizon_days=outcome.horizon_days,
        horizon_months=outcome.horizon_months,
        model_code=outcome.model_code or "",
        model_name=outcome.model_name or "",
        model_version=outcome.model_version or "",
        dataset_version=outcome.dataset_version or "",
        history_months=outcome.available_months,
        history_start=outcome.history_start,
        history_end=outcome.history_end,
        forecast_month=final.month,
        forecast_value=final.value,
        lower_bound=final.lower,
        upper_bound=final.upper,
        interval_level=outcome.interval_level,
        path=[
            {"month": p.month.isoformat(), "value": p.value, "lower": p.lower, "upper": p.upper}
            for p in outcome.path
        ],
        candidates=[
            {
                "code": c.code,
                "name": c.name,
                "version": c.version,
                "kind": c.kind,
                "params": c.params,
                "origins_scored": c.origins_scored,
                "mae": c.mae,
                "rmse": c.rmse,
                "mape": c.mape,
                "directional_accuracy": c.directional_accuracy,
                "eligible": c.eligible,
                "note": c.note,
                "selected": c.code == outcome.model_code,
            }
            for c in outcome.candidates
        ],
        selection_rationale=outcome.selection_rationale or "",
        config={**outcome.config, "last_observed_price": round(last_price, 6)},
        created_by=user.user_id,
    )


def _history_dto(points: list[MonthPoint], window_start: date | None) -> list[dict[str, Any]]:
    return [
        {
            "month": p.month.isoformat(),
            "unit_price": round(p.price, 4),
            "in_model_window": window_start is not None and p.month >= window_start,
        }
        for p in points
    ]


def _not_run_or_withheld(
    horizon_days: int, points: list[MonthPoint], cfg: ForecastConfig
) -> dict[str, Any]:
    run = trailing_consecutive_run(points)
    required = cfg.required_months(horizon_days)
    base = {
        "horizon_days": horizon_days,
        "horizon_months": cfg.horizon_months(horizon_days),
        "required_months": required,
        "available_months": len(run),
        "run": None,
    }
    if len(run) < required:
        reason = (
            f"A {horizon_days}-day outlook needs {required} consecutive months of purchases; "
            f"{len(run)} are available."
        )
        return {**base, "status": "withheld", "reason": reason}
    return {**base, "status": "not_run", "reason": "No forecast has been run for this date yet."}


async def run_forecasts(
    session: AsyncSession,
    user: User,
    material_id: str,
    as_of: date | None = None,
    dataset_id: str | None = None,
    cfg: ForecastConfig | None = None,
) -> dict[str, Any]:
    """
    Run the 30-day and 90-day forecasts for a material and store each one produced.

    A horizon the history cannot support is returned as withheld with the reason, and nothing
    is stored for it. Existing runs are never changed; running again adds new runs.

    Raises:
        NotFoundError: If there is no purchase history or the material is unknown.
        DataLeakageError: If the history contains data after the cutoff (a defect guard).
    """
    cfg = cfg or await model_settings.effective_config(session)  # switched-off models apply
    cutoff, data = await _load(session, material_id, as_of, dataset_id)
    currency, points, excluded = monthly_history(data, cutoff)
    _require_purchases(data, cutoff, points)
    horizons, stored = [], []
    for days in cfg.horizons_days:
        outcome = run_horizon(points, cutoff, days, currency, cfg)
        if outcome.status != FORECAST:
            horizons.append(
                {
                    "horizon_days": days,
                    "horizon_months": outcome.horizon_months,
                    "status": "withheld",
                    "reason": outcome.reason,
                    "required_months": outcome.required_months,
                    "available_months": outcome.available_months,
                    "run": None,
                }
            )
            continue
        run = _to_run(outcome, user, material_id, dataset_id, currency, points[-1].price)
        session.add(run)
        stored.append((days, outcome, run))
    audit.record(
        session,
        user,
        audit.FORECAST_RUN,
        "material",
        material_id,
        f"Forecast run for {material_id}: {len(stored)} stored, {len(horizons)} withheld"
        + (f"; models off: {', '.join(cfg.disabled_models)}" if cfg.disabled_models else "")
        + ".",
    )
    await session.commit()
    for days, outcome, run in stored:
        horizons.append(
            {
                "horizon_days": days,
                "horizon_months": outcome.horizon_months,
                "status": "forecast",
                "reason": None,
                "required_months": outcome.required_months,
                "available_months": outcome.available_months,
                "run": _run_dto(run),
            }
        )
    horizons.sort(key=lambda h: h["horizon_days"])
    return _payload(data, cutoff, currency, points, excluded, horizons)


def _payload(
    data: MaterialData,
    cutoff: date,
    currency: str | None,
    points: list[MonthPoint],
    excluded_partial_month: date | None,
    horizons: list[dict[str, Any]],
) -> dict[str, Any]:
    window = trailing_consecutive_run(points)
    return {
        "material": {
            "material_id": data.material_id,
            "description": data.description,
            "category": data.category,
            "unit_of_measure": data.unit_of_measure,
        },
        "as_of": cutoff.isoformat(),
        "currency": currency,
        "data_frequency": DATA_FREQUENCY,
        "history": _history_dto(points, window[0].month if window else None),
        "usable_history_months": len(window),
        "excluded_partial_month": (
            excluded_partial_month.isoformat() if excluded_partial_month else None
        ),
        "horizons": horizons,
        "computed_at": datetime.now(UTC).isoformat(),
    }


async def get_forecasts(
    session: AsyncSession,
    material_id: str,
    as_of: date | None = None,
    dataset_id: str | None = None,
    cfg: ForecastConfig = DEFAULT_FORECAST_CONFIG,
) -> dict[str, Any]:
    """Latest stored run per horizon for a material, with the history and any withheld reason."""
    cutoff, data = await _load(session, material_id, as_of, dataset_id)
    currency, points, excluded = monthly_history(data, cutoff)
    _require_purchases(data, cutoff, points)
    horizons = []
    for days in cfg.horizons_days:
        stmt = (
            select(ForecastRun)
            .where(ForecastRun.material_id == material_id, ForecastRun.horizon_days == days)
            .where(ForecastRun.as_of == cutoff)
            .order_by(ForecastRun.created_at.desc())
            .limit(1)
        )
        # A run belongs to the dataset scope it was made for (none = all data), never another.
        scope = (
            ForecastRun.dataset_id == dataset_id if dataset_id else ForecastRun.dataset_id.is_(None)
        )
        run = (await session.execute(stmt.where(scope))).scalars().first()
        entry = _not_run_or_withheld(days, points, cfg)
        if run is not None:
            entry = {**entry, "status": "forecast", "reason": None, "run": _run_dto(run)}
        horizons.append(entry)
    return _payload(data, cutoff, currency, points, excluded, horizons)


async def list_runs(
    session: AsyncSession, material_id: str, limit: int = 20, dataset_id: str | None = None
) -> list[dict]:
    """
    Stored runs for a material, newest first (the history of what was forecast, and when).
    All runs are listed unless a dataset is given, which limits the list to that dataset.
    """
    stmt = select(ForecastRun).where(ForecastRun.material_id == material_id)
    if dataset_id:
        stmt = stmt.where(ForecastRun.dataset_id == dataset_id)
    stmt = stmt.order_by(ForecastRun.created_at.desc()).limit(limit)
    return [_run_dto(r) for r in (await session.execute(stmt)).scalars().all()]


async def get_run(session: AsyncSession, run_id: str) -> dict[str, Any]:
    run = await session.get(ForecastRun, run_id)
    if run is None:
        raise NotFoundError(f"Forecast run '{run_id}' was not found.")
    return _run_dto(run)


async def list_forecastable_materials(
    session: AsyncSession,
    as_of: date | None = None,
    dataset_id: str | None = None,
    cfg: ForecastConfig = DEFAULT_FORECAST_CONFIG,
) -> dict[str, Any]:
    """Materials with purchase history and which horizons their history can support."""
    cutoff = as_of or await loader.latest_purchase_date(session, dataset_id)
    if cutoff is None:
        return {"has_data": False, "as_of": None, "materials": []}
    materials, _ = await loader.load_material_data(session, cutoff, dataset_id)
    rows = []
    for m in materials:
        currency, points, _ = monthly_history(m, cutoff)
        if not points:
            continue
        usable = len(trailing_consecutive_run(points))
        rows.append(
            {
                "material_id": m.material_id,
                "description": m.description,
                "category": m.category,
                "currency": currency,
                "history_months": len(points),
                "usable_history_months": usable,
                "supported_horizons_days": [
                    d for d in cfg.horizons_days if usable >= cfg.required_months(d)
                ],
            }
        )
    return {"has_data": True, "as_of": cutoff.isoformat(), "materials": rows}
