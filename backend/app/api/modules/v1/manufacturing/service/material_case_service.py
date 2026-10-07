"""
Material risk to Risk Case (decision D3): opens or links a `material_cost_risk` case from a stored,
high-risk material score.

This service only creates the case and records what was known when it was opened. The case then
follows the existing lifecycle, state machine and separation-of-duties checks unchanged: nothing
here, and nothing added to the case module, branches on the case category for a transition.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import (
    AlreadyExistsError,
    NotFoundError,
    ValidationError,
    WorkflowPreConditionError,
)
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.cases.models.risk_case import (
    CASE_CATEGORY_MATERIAL_COST_RISK,
    CaseHistory,
    RiskCase,
)
from app.api.modules.v1.cases.service.case_service import CaseService
from app.api.modules.v1.manufacturing.models import (
    ForecastRun,
    Material,
    MaterialRiskScore,
    PurchaseRecord,
)
from app.api.modules.v1.manufacturing.service import admin_audit as audit
from app.api.modules.v1.manufacturing.service import exposure_service
from app.api.modules.v1.manufacturing.service import risk_scoring_engine as scoring_engine
from app.api.modules.v1.manufacturing.service.risk_types import Reading

ELIGIBLE_LEVELS = ("High", "Critical")
TOP_SIGNALS = 5
CASE_ACTOR_FALLBACK = "Unknown user"


def _actor(user: User) -> str:
    return user.name or user.username or CASE_ACTOR_FALLBACK


def _signals(score: MaterialRiskScore) -> list[dict[str, Any]]:
    """The factors that drove the score, in the shape the case page already displays."""
    drivers = sorted(
        (f for f in score.factors if f["status"] == "evaluated" and f["points"] > 0),
        key=lambda f: -f["points"],
    )[:TOP_SIGNALS]
    return [
        {
            "rule_code": f"MAT-{f['code'].upper()}",
            "rule_name": f["name"],
            "rule_version": score.weight_version,
            "triggered": True,
            "weight": round(f["points"], 1),
            "score": round(f["points"], 1),
            "explanation": f["explanation"],
            "diagnostics": {
                "source": "material_risk_score",
                "factor": f["code"],
                "value": f["value"],
                "sub_score": f["sub_score"],
            },
        }
        for f in drivers
    ]


async def _main_supplier(session: AsyncSession, score: MaterialRiskScore) -> str | None:
    """The supplier with the largest spend on the material in the year up to the score date."""
    start = score.as_of.replace(year=score.as_of.year - 1)
    spend = func.sum(PurchaseRecord.quantity * PurchaseRecord.unit_price)
    stmt = (
        select(PurchaseRecord.supplier_id)
        .where(
            PurchaseRecord.material_id == score.material_id,
            PurchaseRecord.supplier_id.is_not(None),
            PurchaseRecord.purchase_date > start,
            PurchaseRecord.purchase_date <= score.as_of,
        )
        .group_by(PurchaseRecord.supplier_id)
        .order_by(spend.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalars().first()


async def _forecast_and_exposure(
    session: AsyncSession, score: MaterialRiskScore
) -> tuple[dict | None, dict | None]:
    """The stored forecast the score used, and the exposure it implies, as of the score date."""
    if not score.forecast_run_id:
        return None, None
    run = await session.get(ForecastRun, score.forecast_run_id)
    if run is None:
        return None, None
    last = run.config.get("last_observed_price")
    forecast = {
        "run_id": run.run_id,
        "horizon_days": run.horizon_days,
        "model": f"{run.model_name} v{run.model_version}",
        "forecast_value": run.forecast_value,
        "last_observed_price": last,
        "change_pct": round((run.forecast_value / last - 1) * 100, 2) if last else None,
        "currency": run.currency,
    }
    data = await exposure_service.calculate_exposure(
        session, run.horizon_days, score.as_of, score.dataset_id, score.material_id
    )
    row = next(
        (m for m in data.get("materials", []) if m["material_id"] == score.material_id), None
    )
    if row is None:
        return forecast, None
    exposure = {
        "horizon_days": run.horizon_days,
        "currency": row["currency"],
        "projected_exposure": row["projected_exposure"],
        "baseline_spend": row["baseline_spend"],
        "forecast_spend": row["forecast_spend"],
        "expected_usage": row["expected_usage"],
        "usage_basis": row["usage_basis"],
    }
    return forecast, exposure


async def _open_material_case(session: AsyncSession, material_id: str) -> RiskCase | None:
    stmt = select(RiskCase).where(
        RiskCase.case_category == CASE_CATEGORY_MATERIAL_COST_RISK,
        RiskCase.material_id == material_id,
        RiskCase.status != "Closed",
    )
    return (await session.execute(stmt.order_by(RiskCase.created_at.desc()))).scalars().first()


async def _lock_material(session: AsyncSession, material_id: str) -> None:
    """Make concurrent requests for one material take turns, so only one case can be opened."""
    await session.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
        {"key": f"material-case:{material_id}"},
    )


async def _require_latest(session: AsyncSession, score: MaterialRiskScore) -> None:
    """A case is opened from, or linked to, the material's newest saved score only."""
    stmt = select(MaterialRiskScore).where(
        MaterialRiskScore.material_id == score.material_id,
        MaterialRiskScore.dataset_id == score.dataset_id
        if score.dataset_id
        else MaterialRiskScore.dataset_id.is_(None),
    )
    newest = (
        (await session.execute(stmt.order_by(MaterialRiskScore.created_at.desc()).limit(1)))
        .scalars()
        .first()
    )
    if newest is not None and newest.score_id != score.score_id:
        raise ValidationError(
            f"A newer risk score exists for this material ({newest.score_id}, {newest.level}, "
            f"{newest.score:.1f}). Open or link the case from the latest score."
        )


async def _load_score(session: AsyncSession, score_id: str) -> MaterialRiskScore:
    score = await session.get(MaterialRiskScore, score_id)
    if score is None:
        raise NotFoundError(f"Risk score '{score_id}' was not found.")
    return score


async def open_case(
    session: AsyncSession,
    user: User,
    score_id: str,
    link_case_id: str | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    """
    Open a new material-cost case from a stored high-risk score, or link the score to an
    existing open case for the same material.

    Raises:
        NotFoundError: If the score or the case to link does not exist.
        ValidationError: If the score is below High, or the case is for another material.
        AlreadyExistsError: If an open case for the material exists (link to it instead), or
            the score is already linked.
        WorkflowPreConditionError: If the case to link is closed.
    """
    score = await _load_score(session, score_id)
    await _lock_material(session, score.material_id)  # held until the case is saved
    await _require_latest(session, score)
    if score.level not in ELIGIBLE_LEVELS:
        raise ValidationError(
            f"Only High or Critical materials can open a case; this score is {score.level} "
            f"({score.score:.1f})."
        )
    if link_case_id:
        return await _link(session, user, score, link_case_id, note)
    existing = await _open_material_case(session, score.material_id)
    if existing is not None:
        raise AlreadyExistsError(
            f"Case {existing.case_number} is already open for this material. "
            "Link the score to it instead of opening another."
        )

    forecast, exposure = await _forecast_and_exposure(session, score)
    now = datetime.now(UTC)
    suffix = uuid4().hex[:10].upper()
    case = RiskCase(
        case_id=f"MCR-{suffix}",
        case_number=f"MCR-{now.year}-{suffix}",
        priority="High",
        status="New",
        supplier_id=await _main_supplier(session, score),
        case_category=CASE_CATEGORY_MATERIAL_COST_RISK,
        material_id=score.material_id,
        forecast_horizon=forecast["horizon_days"] if forecast else None,
        projected_exposure_amount=exposure["projected_exposure"] if exposure else None,
        trigger_signals=_signals(score),
        evaluation_snapshot={
            "source": "material_risk_score",
            "score_id": score.score_id,
            "score": score.score,
            "level": score.level,
            "as_of": score.as_of.isoformat(),
            "weight_version": score.weight_version,
            "method_version": score.method_version,
            "data_coverage_pct": score.data_coverage_pct,
            "summary": score.summary,
            "currency": score.currency,
            "factors": score.factors,
            "forecast": forecast,
            "exposure": exposure,
            "linked_scores": [],
        },
    )
    session.add(case)
    await session.flush()
    session.add(
        CaseHistory(
            case_id=case.case_id,
            actor=_actor(user),
            action="Case Created from Material Risk Score",
            previous_status=None,
            new_status="New",
            note=f"{score.summary}{f' Note: {note}' if note else ''}",
        )
    )
    audit.record(
        session,
        user,
        audit.MATERIAL_CASE_OPENED,
        "risk_case",
        case.case_id,
        f"Case {case.case_number} opened for {score.material_id} from risk score "
        f"{score.score:.1f} ({score.level}).",
    )
    await session.commit()
    return {"mode": "created", "case": await CaseService.get_case_by_id(case.case_id, session)}


async def _link(
    session: AsyncSession, user: User, score: MaterialRiskScore, case_id: str, note: str | None
) -> dict[str, Any]:
    case = await session.get(RiskCase, case_id)
    if case is None:
        raise NotFoundError(f"Case '{case_id}' not found")
    if (
        case.case_category != CASE_CATEGORY_MATERIAL_COST_RISK
        or case.material_id != score.material_id
    ):
        raise ValidationError(
            "A score can only be linked to a material-cost case for the same material."
        )
    if case.status == "Closed":
        raise WorkflowPreConditionError(
            "Closed cases cannot be modified. Reopen the case to make changes."
        )
    snapshot = dict(case.evaluation_snapshot)
    linked = list(snapshot.get("linked_scores", []))
    if score.score_id == snapshot.get("score_id") or any(
        entry["score_id"] == score.score_id for entry in linked
    ):
        raise AlreadyExistsError("This risk score is already part of the case.")
    linked.append(
        {
            "score_id": score.score_id,
            "score": score.score,
            "level": score.level,
            "as_of": score.as_of.isoformat(),
            "linked_at": datetime.now(UTC).isoformat(),
            "linked_by": _actor(user),
        }
    )
    case.evaluation_snapshot = {**snapshot, "linked_scores": linked}
    case.updated_at = datetime.now(UTC)
    session.add(case)
    session.add(
        CaseHistory(
            case_id=case.case_id,
            actor=_actor(user),
            action="Material Risk Score Linked",
            previous_status=case.status,
            new_status=case.status,
            note=f"{score.summary}{f' Note: {note}' if note else ''}",
        )
    )
    audit.record(
        session,
        user,
        audit.MATERIAL_CASE_OPENED,
        "risk_case",
        case.case_id,
        f"Risk score {score.score:.1f} ({score.level}) for {score.material_id} was linked to "
        f"the open case {case.case_number}.",
    )
    await session.commit()
    return {"mode": "linked", "case": await CaseService.get_case_by_id(case.case_id, session)}


async def case_context(session: AsyncSession, case_id: str) -> dict[str, Any]:
    """
    What was known when the case was opened (the stored snapshot), whether that score reproduces
    from its own record, and how the material scores now. Read-only.

    Raises:
        NotFoundError: If the case does not exist or is not a material-cost case.
    """
    case = await session.get(RiskCase, case_id)
    if case is None or case.case_category != CASE_CATEGORY_MATERIAL_COST_RISK:
        raise NotFoundError(f"Material case '{case_id}' was not found.")
    snapshot = case.evaluation_snapshot
    score = await _load_score(session, snapshot["score_id"])
    material = await session.get(Material, case.material_id)

    again = scoring_engine.score_material(
        {f["code"]: Reading(f["value"], "") for f in score.factors}, score.config
    )
    newest = (
        (
            await session.execute(
                select(MaterialRiskScore)
                .where(MaterialRiskScore.material_id == case.material_id)
                .order_by(MaterialRiskScore.created_at.desc())
                .limit(1)
            )
        )
        .scalars()
        .first()
    )
    current = None
    if newest is not None and newest.score_id != score.score_id:
        current = {
            "score_id": newest.score_id,
            "score": newest.score,
            "level": newest.level,
            "as_of": newest.as_of.isoformat(),
            "change": round(newest.score - score.score, 4),
            "created_at": newest.created_at.isoformat(),
        }
    return {
        "case_id": case.case_id,
        "material": {
            "material_id": case.material_id,
            "description": material.description if material else case.material_id,
            "category": material.category if material else None,
            "unit_of_measure": material.unit_of_measure if material else None,
        },
        "opened_from": {k: snapshot[k] for k in snapshot if k not in ("forecast", "exposure")},
        "forecast": snapshot.get("forecast"),
        "exposure": snapshot.get("exposure"),
        "replay": {
            "reproduced": abs(again["score"] - score.score) < 1e-3
            and again["level"] == score.level,
            "recomputed_score": again["score"],
            "stored_score": score.score,
            "note": (
                "The score was recalculated from the factor values and weights saved with it, "
                "using only information available on the score date."
            ),
        },
        "current": current,
    }


async def cases_for_material(session: AsyncSession, material_id: str) -> list[dict[str, Any]]:
    """Material-cost cases for a material, newest first (open and closed)."""
    stmt = (
        select(RiskCase)
        .where(
            RiskCase.case_category == CASE_CATEGORY_MATERIAL_COST_RISK,
            RiskCase.material_id == material_id,
        )
        .order_by(RiskCase.created_at.desc())
    )
    return [
        {
            "case_id": c.case_id,
            "case_number": c.case_number,
            "status": c.status,
            "priority": c.priority,
            "created_at": c.created_at.isoformat(),
            "score_ids": [c.evaluation_snapshot.get("score_id")]
            + [e["score_id"] for e in c.evaluation_snapshot.get("linked_scores", [])],
        }
        for c in (await session.execute(stmt)).scalars()
    ]
