"""
Administration overview and audit-log reading (work plan Section 10).

Reads only. Changes are made through the services that own them (model settings, dataset registry,
risk weights, mapping profiles), each of which writes its own audit entry.
"""

from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.modules.v1.auth.models.security_audit_log import SecurityAuditLog
from app.api.modules.v1.manufacturing.service import admin_audit as audit
from app.api.modules.v1.manufacturing.service import model_settings_service as model_settings
from app.api.modules.v1.manufacturing.service import risk_scoring_service as risk_service
from app.api.modules.v1.manufacturing.service.forecast_types import DEFAULT_FORECAST_CONFIG
from app.api.modules.v1.manufacturing.service.validation_types import (
    METHOD_VERSION,
    ValidationConfig,
)

MAX_PAGE = 200
FIXED_NOTE = (
    "Fixed in the software; changing them is a code change that creates a new method version."
)


async def configuration(session: AsyncSession) -> dict[str, Any]:
    """The settings that govern forecasting, risk scoring and validation, as they are now."""
    cfg = DEFAULT_FORECAST_CONFIG
    weights = await risk_service.list_weight_sets(session)
    active = next(v for v in weights["versions"] if v["is_active"])
    defaults = ValidationConfig()
    return {
        "forecast_models": await model_settings.list_models(session),
        "forecast_settings": {
            "horizons_days": list(cfg.horizons_days),
            "required_months": {str(d): cfg.required_months(d) for d in cfg.horizons_days},
            "origins_scored_per_model": cfg.origins,
            "minimum_improvement_for_regression": cfg.min_improvement,
            "prediction_band": cfg.interval_level,
            "months_used_by_regression": cfg.trend_window,
            "note": FIXED_NOTE,
        },
        "risk_weights": {
            "active_version": weights["active_version"],
            "method_version": weights["method_version"],
            "versions_stored": len(weights["versions"]),
            "saved_by": active["created_by"],
            "saved_at": active["created_at"],
            "note": active["note"],
            "bands": active["config"]["bands"],
            "weights": active["config"]["weights"],
        },
        "validation_defaults": {
            "horizons_days": list(defaults.horizons_days),
            "cutoff_step_months": defaults.cutoff_step_months,
            "event_threshold_pct": defaults.event_threshold_pct,
            "alert_threshold": defaults.alert_threshold,
            "flat_band_pct": defaults.flat_band_pct,
            "method_version": METHOD_VERSION,
        },
    }


def _utc(moment: datetime) -> datetime:
    """The audit table stores UTC without a zone; say so, so screens can show local time."""
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def _label(event_type: str) -> str:
    return audit.EVENT_LABELS.get(event_type, event_type.replace("_", " ").capitalize())


def _row(row: SecurityAuditLog) -> dict[str, Any]:
    return {
        "id": row.id,
        "occurred_at": _utc(row.occurred_at).isoformat(),
        "event_type": row.event_type,
        "event": _label(row.event_type),
        "actor_id": row.actor_id,
        "actor": row.actor_username,
        "actor_role": row.actor_role,
        "resource_type": row.resource_type,
        "resource_id": row.resource_id,
        "detail": row.detail,
    }


async def audit_events(
    session: AsyncSession,
    event_type: str | None = None,
    actor: str | None = None,
    since: date | None = None,
    until: date | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """The audit trail, newest first, with simple filters and paging."""
    stmt = select(SecurityAuditLog)
    if event_type:
        stmt = stmt.where(SecurityAuditLog.event_type == event_type)
    if actor:
        stmt = stmt.where(func.lower(SecurityAuditLog.actor_username).contains(actor.lower()))
    if since:
        stmt = stmt.where(SecurityAuditLog.occurred_at >= datetime.combine(since, time.min))
    if until:
        stmt = stmt.where(
            SecurityAuditLog.occurred_at < datetime.combine(until + timedelta(days=1), time.min)
        )
    total = (await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    page = (
        await session.execute(
            stmt.order_by(SecurityAuditLog.occurred_at.desc(), SecurityAuditLog.id.desc())
            .limit(min(max(limit, 1), MAX_PAGE))
            .offset(max(offset, 0))
        )
    ).scalars()
    present = (await session.execute(select(SecurityAuditLog.event_type).distinct())).all()
    return {
        "total": total,
        "items": [_row(r) for r in page],
        "event_types": sorted(
            ({"code": r[0], "label": _label(r[0])} for r in present), key=lambda t: t["label"]
        ),
    }
