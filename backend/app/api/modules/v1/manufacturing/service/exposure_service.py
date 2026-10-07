"""
Exposure service: reads the stored forecasts and the as-of-limited purchase data, and returns
exposure with roll-ups, optionally under a what-if scenario.

This module only reads. It never creates, changes or deletes a forecast run, and a scenario is
computed from the request alone and returned, never stored.
"""

from collections import defaultdict
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import NotFoundError, ValidationError
from app.api.modules.v1.manufacturing.models import ForecastRun, ProductionRecord
from app.api.modules.v1.manufacturing.service import analytics_loader as loader
from app.api.modules.v1.manufacturing.service import exposure_engine as engine
from app.api.modules.v1.manufacturing.service.analytics_types import MaterialData, MonthPoint
from app.api.modules.v1.manufacturing.service.exposure_types import (
    DEFAULT_EXPOSURE_CONFIG,
    METHOD_VERSION,
    ExposureConfig,
    ExposureInput,
    Scenario,
    StoredForecast,
)
from app.api.modules.v1.manufacturing.service.forecast_history import trailing_consecutive_run
from app.api.modules.v1.manufacturing.service.forecast_service import monthly_history
from app.api.modules.v1.manufacturing.service.forecast_types import DEFAULT_FORECAST_CONFIG
from app.api.modules.v1.manufacturing.service.price_series import month_end

SCENARIO_LABEL = "Scenario — a what-if calculation, not a prediction. Nothing here is saved."
BASELINE_LABEL = "Exposure from the stored forecast"


def _round(value: Any) -> Any:
    if isinstance(value, float):
        return round(value, 4)
    if isinstance(value, dict):
        return {k: _round(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_round(v) for v in value]
    return value


def _stored(run: ForecastRun) -> StoredForecast:
    return StoredForecast(
        run_id=run.run_id,
        model_name=run.model_name,
        model_version=run.model_version,
        as_of=run.as_of,
        horizon_days=run.horizon_days,
        horizon_months=run.horizon_months,
        currency=run.currency,
        last_observed_price=float(run.config["last_observed_price"]),
        path_values=tuple(float(p["value"]) for p in run.path),
        end_value=run.forecast_value,
        history_end=run.history_end,
        created_at=run.created_at.isoformat(),
    )


async def latest_runs(
    session: AsyncSession, cutoff: date, horizon_days: int, dataset_id: str | None
) -> dict[str, ForecastRun]:
    """Newest stored run per material for this date, horizon and dataset scope."""
    scope = ForecastRun.dataset_id == dataset_id if dataset_id else ForecastRun.dataset_id.is_(None)
    stmt = (
        select(ForecastRun)
        .where(ForecastRun.as_of == cutoff, ForecastRun.horizon_days == horizon_days, scope)
        .order_by(ForecastRun.created_at.asc())
    )
    runs = (await session.execute(stmt)).scalars().all()
    return {r.material_id: r for r in runs}  # later rows replace earlier ones: newest wins


async def _volumes(
    session: AsyncSession, cutoff: date, dataset_id: str | None
) -> dict[str, list[tuple[date, float]]]:
    """Actual production volume per product (periods ended on or before the cutoff)."""
    stmt = select(ProductionRecord).where(
        ProductionRecord.period_end <= cutoff, ProductionRecord.actual_volume.is_not(None)
    )
    if dataset_id:
        stmt = stmt.where(ProductionRecord.dataset_id == dataset_id)
    out: dict[str, list[tuple[date, float]]] = defaultdict(list)
    for r in (await session.execute(stmt)).scalars():
        out[r.product_sku].append((r.period_end, float(r.actual_volume)))
    return out


def _product_weights(
    data: MaterialData, cutoff: date, window: list[date], volumes: dict[str, list]
) -> dict[str, float]:
    """BOM quantity x recent actual production volume, for products that use the material."""
    weights: dict[str, float] = {}
    for b in data.bom:
        if (b.effective_from and b.effective_from > cutoff) or (
            b.effective_to and b.effective_to < cutoff
        ):
            continue
        volume = sum(
            v
            for end, v in volumes.get(b.product_sku, [])
            if window[0] <= end <= month_end(window[-1])
        )
        if volume > 0:
            weights[b.product_sku] = weights.get(b.product_sku, 0.0) + b.bom_quantity * volume
    return weights


def _lead_time(data: MaterialData, shares: dict[str, float]) -> float | None:
    """Latest known lead time per supplier, averaged by each supplier's share of usage."""
    latest: dict[str, tuple[date, float]] = {}
    for o in data.ops:
        if o.lead_time_days is not None and (
            o.supplier_id not in latest or o.metric_date >= latest[o.supplier_id][0]
        ):
            latest[o.supplier_id] = (o.metric_date, o.lead_time_days)
    known = {s: latest[s][1] for s in shares if s in latest}
    weight = sum(shares[s] for s in known)
    return sum(shares[s] * lt for s, lt in known.items()) / weight if weight else None


def _build_input(
    data: MaterialData,
    run: ForecastRun,
    points: list[MonthPoint],
    cutoff: date,
    volumes: dict[str, list],
    cfg: ExposureConfig,
) -> ExposureInput:
    window = engine.usage_window(points[-1].month, points[0].month, cfg)
    usage, shares = engine.usage_and_supplier_shares(data.purchases, run.currency, window)
    snapshot = max(data.inventory, key=lambda i: i.snapshot_date, default=None)
    return ExposureInput(
        material_id=data.material_id,
        description=data.description,
        category=data.category,
        unit_of_measure=data.unit_of_measure,
        forecast=_stored(run),
        monthly_usage=usage,
        usage_months=len(window),
        supplier_shares=shares,
        product_weights=_product_weights(data, cutoff, window, volumes),
        inventory_on_hand=snapshot.quantity_on_hand if snapshot else None,
        inventory_date=snapshot.snapshot_date if snapshot else None,
        lead_time_days=_lead_time(data, shares),
    )


def _unavailable(data: MaterialData, points: list[MonthPoint], horizon_days: int) -> dict:
    required = DEFAULT_FORECAST_CONFIG.required_months(horizon_days)
    usable = len(trailing_consecutive_run(points))
    if usable < required:
        reason = (
            f"A {horizon_days}-day forecast needs {required} consecutive months of purchases; "
            f"{usable} are available."
        )
    else:
        reason = f"No {horizon_days}-day forecast has been run for this date. Run it first."
    return {"material_id": data.material_id, "description": data.description, "reason": reason}


def _check_scenario(s: Scenario, inputs: list[ExposureInput]) -> None:
    if s.supplier_id and not any(s.supplier_id in i.supplier_shares for i in inputs):
        raise ValidationError(
            f"Supplier '{s.supplier_id}' has no recent purchases of the materials analysed."
        )


async def calculate_exposure(
    session: AsyncSession,
    horizon_days: int,
    as_of: date | None = None,
    dataset_id: str | None = None,
    material_id: str | None = None,
    scenario: Scenario | None = None,
    cfg: ExposureConfig = DEFAULT_EXPOSURE_CONFIG,
) -> dict[str, Any]:
    """
    Financial exposure per material with roll-ups by supplier, product and category.

    The baseline comes from the stored forecast run of each material (never recomputed here).
    With a scenario, every figure is recalculated from the same stored values and labelled as a
    scenario; the stored runs are not touched.

    Raises:
        ValidationError: If the horizon is not a forecast horizon, or the scenario names a
            supplier that has no purchases in the data.
        NotFoundError: If a requested material is not in the analysed data.
    """
    if horizon_days not in DEFAULT_FORECAST_CONFIG.horizons_days:
        raise ValidationError(
            f"Horizon must be one of {list(DEFAULT_FORECAST_CONFIG.horizons_days)} days."
        )
    cutoff = as_of or await loader.latest_purchase_date(session, dataset_id)
    if cutoff is None:
        return {"has_data": False, "as_of": None, "horizon_days": horizon_days}
    materials, _ = await loader.load_material_data(session, cutoff, dataset_id)
    if material_id and not any(m.material_id == material_id for m in materials):
        raise NotFoundError(f"Material '{material_id}' was not found in the analysed data.")
    runs = await latest_runs(session, cutoff, horizon_days, dataset_id)
    volumes = await _volumes(session, cutoff, dataset_id)

    inputs: list[ExposureInput] = []
    unavailable: list[dict] = []
    notes: dict[str, str] = {}
    for data in materials:
        if material_id and data.material_id != material_id:
            continue
        _, points, _ = monthly_history(data, cutoff)
        if not points:
            continue
        run = runs.get(data.material_id)
        if run is None:
            unavailable.append(_unavailable(data, points, horizon_days))
            continue
        inputs.append(_build_input(data, run, points, cutoff, volumes, cfg))
        if abs(points[-1].price - run.config["last_observed_price"]) > 1e-4:
            notes[data.material_id] = (
                "Purchase data has changed since this forecast was stored. Run the forecast again."
            )
    if scenario is not None:
        _check_scenario(scenario, inputs)

    rows = []
    for inp in inputs:
        row = engine.baseline_exposure(inp)
        if scenario is not None:
            row["scenario"] = engine.apply_scenario(inp, row, scenario)
        if inp.material_id in notes:
            row["stale_note"] = notes[inp.material_id]
        rows.append(row)
    rows.sort(
        key=lambda r: r["scenario"]["scenario_exposure"] if scenario else r["projected_exposure"],
        reverse=True,
    )
    with_scenario = scenario is not None
    return _round(
        {
            "has_data": True,
            "kind": "scenario" if with_scenario else "baseline",
            "label": SCENARIO_LABEL if with_scenario else BASELINE_LABEL,
            "method_version": METHOD_VERSION,
            "as_of": cutoff.isoformat(),
            "horizon_days": horizon_days,
            "horizon_months": DEFAULT_FORECAST_CONFIG.horizon_months(horizon_days),
            "usage_window_months": cfg.usage_window_months,
            "scenario": _scenario_dto(scenario) if scenario else None,
            "materials": rows,
            "not_available": unavailable,
            "rollups": {
                dim: engine.rollup(rows, dim, with_scenario)
                for dim in ("supplier", "product", "category")
            },
            "computed_at": datetime.now(UTC).isoformat(),
        }
    )


def _scenario_dto(s: Scenario) -> dict[str, Any]:
    return {
        "price_change_pct": s.price_change_pct,
        "demand_change_pct": s.demand_change_pct,
        "lead_time_delay_days": s.lead_time_delay_days,
        "inventory_change_pct": s.inventory_change_pct,
        "supplier_id": s.supplier_id,
        "supplier_price_change_pct": s.supplier_price_change_pct,
        "spot_premium_pct": s.spot_premium_pct,
    }
