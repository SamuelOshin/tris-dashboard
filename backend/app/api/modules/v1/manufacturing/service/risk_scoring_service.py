"""
MaterialRiskScoringService (decision D4): scores materials, stores every score as an immutable
row, and manages the versioned weight sets.

It is deliberately separate from the R-001..R-007 rule engine: it imports nothing from the rules
package, reads no rule-engine configuration and writes only its own two tables.

The as-of date is applied in the database queries (through the shared loader), so data after it
never reaches a factor.
"""

import hashlib
import json
from copy import deepcopy
from datetime import date
from typing import Any
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import NotFoundError
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.manufacturing.models import (
    ForecastRun,
    MaterialRiskScore,
    MaterialRiskWeightSet,
)
from app.api.modules.v1.manufacturing.service import admin_audit as audit
from app.api.modules.v1.manufacturing.service import analytics_loader as loader
from app.api.modules.v1.manufacturing.service import risk_factors as factors
from app.api.modules.v1.manufacturing.service import risk_scoring_engine as engine
from app.api.modules.v1.manufacturing.service.analytics_types import DEFAULT_CONFIG
from app.api.modules.v1.manufacturing.service.detection_engine import compute_results
from app.api.modules.v1.manufacturing.service.risk_types import (
    DEFAULT_CONFIG as DEFAULT_WEIGHTS,
)
from app.api.modules.v1.manufacturing.service.risk_types import (
    METHOD_VERSION,
    ForecastRef,
    Reading,
)

SYSTEM_USER = "system"
DEFAULT_NOTE = "Initial weights and scales (method 1.0)."
WEIGHT_SET_LOCK = 90_031_001  # serialises weight set creation (released when the transaction ends)


def _weight_dto(row: MaterialRiskWeightSet, active_version: int) -> dict[str, Any]:
    return {
        "version": row.version,
        "is_active": row.version == active_version,
        "config": row.config,
        "note": row.note,
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat(),
    }


async def _latest_weight_set(session: AsyncSession) -> MaterialRiskWeightSet | None:
    stmt = select(MaterialRiskWeightSet).order_by(MaterialRiskWeightSet.version.desc()).limit(1)
    return (await session.execute(stmt)).scalars().first()


async def _lock_weight_sets(session: AsyncSession) -> None:
    """Make concurrent writers of weight sets take turns, so versions never collide."""
    await session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": WEIGHT_SET_LOCK})


async def active_weight_set(session: AsyncSession) -> MaterialRiskWeightSet:
    """The newest weight set. The documented defaults are stored as version 1 on first use."""
    latest = await _latest_weight_set(session)
    if latest is None:
        await _lock_weight_sets(session)
        latest = await _latest_weight_set(session)  # another request may have stored it meanwhile
    if latest is None:
        latest = MaterialRiskWeightSet(
            version=1, config=deepcopy(DEFAULT_WEIGHTS), note=DEFAULT_NOTE, created_by=SYSTEM_USER
        )
        session.add(latest)
        await session.commit()
    return latest


async def list_weight_sets(session: AsyncSession) -> dict[str, Any]:
    """Every weight set version, newest first, with the active one marked."""
    active = await active_weight_set(session)
    stmt = select(MaterialRiskWeightSet).order_by(MaterialRiskWeightSet.version.desc())
    rows = (await session.execute(stmt)).scalars().all()
    return {
        "active_version": active.version,
        "method_version": METHOD_VERSION,
        "versions": [_weight_dto(r, active.version) for r in rows],
    }


async def create_weight_set(
    session: AsyncSession, user: User, config: dict[str, Any], note: str
) -> dict[str, Any]:
    """
    Store a new weight set version and make it the active one. Earlier versions and every score
    already stored are untouched.

    Raises:
        ValidationError: If the weights, scales or bands are not valid.
    """
    engine.validate_config(config)
    await active_weight_set(session)  # makes sure version 1 exists
    await _lock_weight_sets(session)
    latest = await _latest_weight_set(session)  # read again under the lock
    row = MaterialRiskWeightSet(
        version=latest.version + 1, config=config, note=note, created_by=user.user_id
    )
    session.add(row)
    audit.record(
        session,
        user,
        audit.RISK_WEIGHTS_CREATED,
        "risk_weight_set",
        str(row.version),
        f"Risk weights version {row.version} saved (High band {config['bands']['high']:g}). "
        f"Reason: {note}",
    )
    await session.commit()
    return _weight_dto(row, row.version)


async def _forecast_refs(
    session: AsyncSession, cutoff: date, dataset_id: str | None
) -> dict[str, ForecastRef]:
    """Per material, its newest stored forecast of the longest horizon for this date."""
    scope = ForecastRun.dataset_id == dataset_id if dataset_id else ForecastRun.dataset_id.is_(None)
    stmt = (
        select(ForecastRun)
        .where(ForecastRun.as_of == cutoff, scope)
        .order_by(ForecastRun.horizon_days.asc(), ForecastRun.created_at.asc())
    )
    refs: dict[str, ForecastRef] = {}
    for run in (await session.execute(stmt)).scalars():
        last = run.config.get("last_observed_price")
        if last:
            change = (run.forecast_value / last - 1) * 100
            refs[run.material_id] = ForecastRef(run.run_id, run.horizon_days, change)
    return refs


def _fingerprint(readings: dict[str, Reading], cutoff: date, forecast: ForecastRef | None) -> str:
    payload = json.dumps(
        {
            "as_of": cutoff.isoformat(),
            "forecast": forecast.run_id if forecast else None,
            "readings": {
                c: (None if r.raw is None else round(r.raw, 8)) for c, r in readings.items()
            },
        },
        sort_keys=True,
    )
    return "sha256:" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def _score_dto(row: MaterialRiskScore, with_factors: bool = True) -> dict[str, Any]:
    dto = {
        "score_id": row.score_id,
        "material_id": row.material_id,
        "as_of": row.as_of.isoformat(),
        "dataset_id": row.dataset_id,
        "currency": row.currency,
        "score": row.score,
        "level": row.level,
        "data_coverage_pct": row.data_coverage_pct,
        "summary": row.summary,
        "method_version": row.method_version,
        "weight_version": row.weight_version,
        "forecast_run_id": row.forecast_run_id,
        "inputs_version": row.inputs_version,
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat(),
    }
    if with_factors:
        dto["factors"] = row.factors
        dto["config"] = row.config
    return dto


async def run_scoring(
    session: AsyncSession,
    user: User,
    as_of: date | None = None,
    dataset_id: str | None = None,
    material_id: str | None = None,
) -> dict[str, Any]:
    """
    Score materials as of a date and store each score produced as a new immutable row.

    A material that cannot be scored (too little of the weighting has data) is returned with the
    reason and nothing is stored for it. Earlier scores are never changed.

    Raises:
        NotFoundError: If no data is loaded, or the requested material is not in the data.
    """
    cutoff = as_of or await loader.latest_purchase_date(session, dataset_id)
    if cutoff is None:
        raise NotFoundError("No purchase history has been loaded yet.")
    weight_set = await active_weight_set(session)
    materials, all_bom = await loader.load_material_data(session, cutoff, dataset_id)
    if material_id and not any(m.material_id == material_id for m in materials):
        raise NotFoundError(f"Material '{material_id}' was not found in the analysed data.")
    results = compute_results(materials, all_bom, cutoff, DEFAULT_CONFIG)
    price_of = {r.material_id: r.metrics.get("latest_price") for r in results}
    currency_of = {r.material_id: r.currency for r in results}
    refs = await _forecast_refs(session, cutoff, dataset_id)

    scored, not_scored = [], []
    for result in results:
        if material_id and result.material_id != material_id:
            continue
        if not result.series:
            not_scored.append(
                {
                    "material_id": result.material_id,
                    "description": result.description,
                    "reason": "No purchases are on record up to this date.",
                }
            )
            continue
        forecast = refs.get(result.material_id)
        readings = factors.read_all(
            result.material_id, result.metrics, result.series, forecast, all_bom, price_of,
            currency_of, cutoff,
        )  # fmt: skip
        outcome = engine.score_material(readings, weight_set.config)
        if outcome["status"] != "scored":
            not_scored.append(
                {
                    "material_id": result.material_id,
                    "description": result.description,
                    "reason": outcome["summary"],
                }
            )
            continue
        row = MaterialRiskScore(
            score_id=f"MRS-{uuid4().hex[:12]}",
            material_id=result.material_id,
            dataset_id=dataset_id,
            as_of=cutoff,
            currency=result.currency,
            method_version=METHOD_VERSION,
            weight_version=weight_set.version,
            score=outcome["score"],
            level=outcome["level"],
            data_coverage_pct=outcome["data_coverage_pct"],
            factors=outcome["factors"],
            summary=outcome["summary"],
            config=weight_set.config,
            forecast_run_id=forecast.run_id if forecast else None,
            inputs_version=_fingerprint(readings, cutoff, forecast),
            created_by=user.user_id,
        )
        session.add(row)
        scored.append((result.description, row))
    audit.record(
        session,
        user,
        audit.RISK_SCORING_RUN,
        "material_risk_score",
        material_id,
        f"Risk scores calculated with weights version {weight_set.version}: "
        f"{len(scored)} scored, {len(not_scored)} not scored.",
    )
    await session.commit()
    return {
        "as_of": cutoff.isoformat(),
        "weight_version": weight_set.version,
        "scored": [{"description": d, **_score_dto(r, with_factors=False)} for d, r in scored],
        "not_scored": not_scored,
    }


def _scope(dataset_id: str | None):
    return (
        MaterialRiskScore.dataset_id == dataset_id
        if dataset_id
        else MaterialRiskScore.dataset_id.is_(None)
    )


async def latest_scores(
    session: AsyncSession, as_of: date | None = None, dataset_id: str | None = None
) -> dict[str, Any]:
    """The newest stored score per material for the date (summary only, no factor detail)."""
    cutoff = as_of or await loader.latest_purchase_date(session, dataset_id)
    if cutoff is None:
        return {"has_data": False, "as_of": None, "scores": []}
    stmt = (
        select(MaterialRiskScore)
        .where(MaterialRiskScore.as_of == cutoff, _scope(dataset_id))
        .order_by(MaterialRiskScore.created_at.asc())
    )
    newest = {r.material_id: r for r in (await session.execute(stmt)).scalars()}
    rows = sorted(newest.values(), key=lambda r: -r.score)
    return {
        "has_data": True,
        "as_of": cutoff.isoformat(),
        "scores": [_score_dto(r, with_factors=False) for r in rows],
    }


async def material_scores(
    session: AsyncSession,
    material_id: str,
    as_of: date | None = None,
    dataset_id: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """The latest stored score for a material and date, with every factor, plus its history."""
    cutoff = as_of or await loader.latest_purchase_date(session, dataset_id)
    stmt = (
        select(MaterialRiskScore)
        .where(MaterialRiskScore.material_id == material_id, _scope(dataset_id))
        .order_by(MaterialRiskScore.created_at.desc())
    )
    rows = (await session.execute(stmt)).scalars().all()
    current = next((r for r in rows if r.as_of == cutoff), None)
    return {
        "material_id": material_id,
        "as_of": cutoff.isoformat() if cutoff else None,
        "current": _score_dto(current) if current else None,
        "history": [_score_dto(r, with_factors=False) for r in rows[:limit]],
    }


async def get_score(session: AsyncSession, score_id: str) -> dict[str, Any]:
    row = await session.get(MaterialRiskScore, score_id)
    if row is None:
        raise NotFoundError(f"Risk score '{score_id}' was not found.")
    return _score_dto(row)
