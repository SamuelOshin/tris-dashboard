"""
Stored results by material, and the manufacturing summary for the main dashboard.

This module only reads what is already stored (forecast runs, risk scores) and what the other
services calculate from source data (exposure, detection signals). It never creates or changes a
forecast, a score or a case, and it never adds amounts in different currencies together.

Definitions used on the dashboard (also written in UI_NAVIGATION_SPEC.md):
- High-risk material: the newest stored score for the data date is High or Critical.
- 30-day increase: the newest stored 30-day forecast is above the last observed price.
- Supplier concentration exposure: the trailing-spend of materials whose "Dependence on one
  supplier" signal is triggered, per currency.
- Risk trend: one point per set of scores (data date and weight version); the newest score per
  material in each set is counted.
"""

from collections import defaultdict
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.modules.v1.cases.models.risk_case import CASE_CATEGORY_MATERIAL_COST_RISK, RiskCase
from app.api.modules.v1.manufacturing.models import ForecastRun, MaterialRiskScore
from app.api.modules.v1.manufacturing.service import analytics_loader as loader
from app.api.modules.v1.manufacturing.service import analytics_service as analytics
from app.api.modules.v1.manufacturing.service import exposure_service as exposure
from app.api.modules.v1.manufacturing.service import risk_scoring_service as scoring
from app.api.modules.v1.manufacturing.service.analytics_types import TRIGGERED
from app.api.modules.v1.manufacturing.service.forecast_types import DEFAULT_FORECAST_CONFIG

HIGH_LEVELS = ("High", "Critical")
EXPOSURE_HORIZON_DAYS = 90
TOP_EXPOSURE_ROWS = 5


def _forecast_view(run: ForecastRun) -> dict[str, Any]:
    last = run.config.get("last_observed_price")
    return {
        "run_id": run.run_id,
        "horizon_days": run.horizon_days,
        "value": run.forecast_value,
        "lower": run.lower_bound,
        "upper": run.upper_bound,
        "last_observed_price": last,
        "change_pct": round((run.forecast_value / last - 1) * 100, 2) if last else None,
        "currency": run.currency,
        "model": run.model_name,
        "model_version": run.model_version,
        "dataset_version": run.dataset_version,
        "forecast_month": run.forecast_month.isoformat(),
        "stored_at": run.created_at.isoformat(),
    }


async def _open_cases(session: AsyncSession) -> dict[str, dict[str, str]]:
    stmt = (
        select(RiskCase)
        .where(
            RiskCase.case_category == CASE_CATEGORY_MATERIAL_COST_RISK,
            RiskCase.status != "Closed",
        )
        .order_by(RiskCase.created_at.asc())
    )
    rows = (await session.execute(stmt)).scalars().all()
    # Newest open case per material wins.
    return {c.material_id: {"case_id": c.case_id, "case_number": c.case_number} for c in rows}


async def material_results(
    session: AsyncSession, as_of: date | None = None, dataset_id: str | None = None
) -> dict[str, Any]:
    """
    For every material: its newest stored score, newest stored 30- and 90-day forecasts, the
    90-day projected exposure, and its open case if there is one.

    Returns `has_data=False` and no materials when nothing has been imported.
    """
    cutoff = as_of or await loader.latest_purchase_date(session, dataset_id)
    if cutoff is None:
        return {"has_data": False, "as_of": None, "materials": {}}
    runs = {
        days: await exposure.latest_runs(session, cutoff, days, dataset_id)
        for days in DEFAULT_FORECAST_CONFIG.horizons_days
    }
    exposures = await exposure.calculate_exposure(
        session, EXPOSURE_HORIZON_DAYS, cutoff, dataset_id
    )
    exposure_of = {r["material_id"]: r for r in exposures.get("materials", [])}
    score_rows = (await scoring.latest_scores(session, cutoff, dataset_id)).get("scores", [])
    score_of = {s["material_id"]: s for s in score_rows}
    cases = await _open_cases(session)
    material_ids = set(score_of) | set(exposure_of) | {m for r in runs.values() for m in r}
    materials: dict[str, Any] = {}
    for material_id in sorted(material_ids):
        score = score_of.get(material_id)
        row = exposure_of.get(material_id)
        materials[material_id] = {
            "forecasts": {
                str(days): _forecast_view(by_material[material_id])
                for days, by_material in runs.items()
                if material_id in by_material
            },
            "exposure": None
            if row is None
            else {
                "horizon_days": EXPOSURE_HORIZON_DAYS,
                "currency": row["currency"],
                "projected_exposure": row["projected_exposure"],
                "exposure_pct": row["exposure_pct"],
                "baseline_spend": row["baseline_spend"],
                "forecast_spend": row["forecast_spend"],
                "stale_note": row.get("stale_note"),
            },
            "score": None
            if score is None
            else {
                "score_id": score["score_id"],
                "score": score["score"],
                "level": score["level"],
                "weight_version": score["weight_version"],
                "stored_at": score["created_at"],
            },
            "open_case": cases.get(material_id),
        }
    return {"has_data": True, "as_of": cutoff.isoformat(), "materials": materials}


async def _trend(
    session: AsyncSession, dataset_id: str | None, as_of: date | None
) -> list[dict[str, Any]]:
    stmt = (
        select(MaterialRiskScore)
        .where(
            MaterialRiskScore.dataset_id == dataset_id
            if dataset_id
            else MaterialRiskScore.dataset_id.is_(None)
        )
        .order_by(MaterialRiskScore.created_at.asc())
    )
    newest: dict[tuple[date, int, str], MaterialRiskScore] = {}
    for row in (await session.execute(stmt)).scalars():
        if as_of is not None and row.as_of > as_of:
            continue  # a view as of an earlier date shows no later score sets
        newest[(row.as_of, row.weight_version, row.material_id)] = row  # later replaces earlier
    sets: dict[tuple[date, int], list[MaterialRiskScore]] = defaultdict(list)
    for (as_of, version, _), row in newest.items():
        sets[(as_of, version)].append(row)
    points = []
    for (as_of, version), rows in sets.items():
        points.append(
            {
                "as_of": as_of.isoformat(),
                "weight_version": version,
                "scored": len(rows),
                "high_or_critical": sum(1 for r in rows if r.level in HIGH_LEVELS),
                "stored_at": max(r.created_at for r in rows).isoformat(),
            }
        )
    return sorted(points, key=lambda p: (p["stored_at"], p["weight_version"]))


def _sum_by_currency(rows: list[tuple[str | None, float]]) -> dict[str, float]:
    out: dict[str, float] = defaultdict(float)
    for currency, amount in rows:
        out[currency or "unknown"] += amount
    return {c: round(v, 2) for c, v in sorted(out.items())}


async def summary(
    session: AsyncSession, as_of: date | None = None, dataset_id: str | None = None
) -> dict[str, Any]:
    """
    The manufacturing figures for the dashboard: four headline numbers, a risk trend and the
    materials with the largest projected exposure. Each part says why it is empty when it is.
    """
    results = await material_results(session, as_of, dataset_id)
    if not results["has_data"]:
        return {"has_data": False, "as_of": None}
    overview = await analytics.get_overview(session, as_of, dataset_id=dataset_id)
    by_id = {m["material_id"]: m for m in overview["materials"]}
    mats = results["materials"]
    total = len(by_id)

    scored = {k: v for k, v in mats.items() if v["score"]}
    high = [k for k, v in scored.items() if v["score"]["level"] in HIGH_LEVELS]
    with_exposure = {k: v for k, v in mats.items() if v["exposure"]}
    with_30 = {k: v for k, v in mats.items() if "30" in v["forecasts"]}
    rising = [k for k, v in with_30.items() if (v["forecasts"]["30"]["change_pct"] or 0) > 0]
    concentrated = [
        m
        for m in overview["materials"]
        if any(
            s["code"] == "supplier_concentration" and s["status"] == TRIGGERED for s in m["signals"]
        )
    ]

    # Amounts in different currencies are never compared, so each currency has its own ranking.
    top: list[tuple[str, dict[str, Any]]] = []
    for currency in sorted({v["exposure"]["currency"] or "" for v in with_exposure.values()}):
        in_currency = [
            kv for kv in with_exposure.items() if (kv[1]["exposure"]["currency"] or "") == currency
        ]
        in_currency.sort(key=lambda kv: -kv[1]["exposure"]["projected_exposure"])
        top.extend(in_currency[:TOP_EXPOSURE_ROWS])
    return {
        "has_data": True,
        "as_of": results["as_of"],
        "computed_at": datetime.now(UTC).isoformat(),
        "materials_total": total,
        "high_risk": {
            "count": len(high),
            "scored": len(scored),
            "materials": [
                {
                    "material_id": k,
                    "description": by_id.get(k, {}).get("description", k),
                    "score": scored[k]["score"]["score"],
                    "level": scored[k]["score"]["level"],
                }
                for k in sorted(high, key=lambda k: -scored[k]["score"]["score"])
            ],
            "reason_empty": None if scored else "No risk scores are stored yet.",
        },
        "projected_exposure": {
            "horizon_days": EXPOSURE_HORIZON_DAYS,
            "by_currency": _sum_by_currency(
                [
                    (v["exposure"]["currency"], v["exposure"]["projected_exposure"])
                    for v in with_exposure.values()
                ]
            ),
            "materials_counted": len(with_exposure),
            "reason_empty": None if with_exposure else "No forecasts are stored yet.",
        },
        "forecast_increase_30d": {
            "count": len(rising),
            "forecasted": len(with_30),
            "reason_empty": None if with_30 else "No 30-day forecasts are stored yet.",
        },
        "supplier_concentration": {
            "count": len(concentrated),
            "spend_window_days": overview["summary"]["spend_window_days"]
            if overview["summary"]
            else None,
            "spend_by_currency": _sum_by_currency(
                [(m["currency"], m["spend_window_total"]) for m in concentrated]
            ),
        },
        "risk_trend": await _trend(session, dataset_id, as_of),
        "top_exposure": [
            {
                "material_id": k,
                "description": by_id.get(k, {}).get("description", k),
                "currency": v["exposure"]["currency"],
                "projected_exposure": v["exposure"]["projected_exposure"],
                "exposure_pct": v["exposure"]["exposure_pct"],
                "change_pct_30d": (v["forecasts"].get("30") or {}).get("change_pct"),
                "level": v["score"]["level"] if v["score"] else None,
                "open_case": v["open_case"],
            }
            for k, v in top
        ],
    }
