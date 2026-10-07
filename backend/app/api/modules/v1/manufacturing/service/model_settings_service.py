"""
Which forecast models may be used.

A model is switched off or on by adding a row (`forecast_model_settings`); nothing is edited or
deleted, so the history of every change stays. The baseline models (naive, moving average,
exponential smoothing) cannot be switched off: a regression model is only ever chosen when it beats
the best baseline, so at least one baseline must always be available. Forecasts already stored keep
the model they were made with; switching a model off affects only new forecasts and validations.
"""

from dataclasses import replace
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import NotFoundError, ValidationError
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.manufacturing.models import ForecastModelSetting
from app.api.modules.v1.manufacturing.service import admin_audit as audit
from app.api.modules.v1.manufacturing.service import forecast_models as models
from app.api.modules.v1.manufacturing.service.forecast_types import (
    DEFAULT_FORECAST_CONFIG,
    ForecastConfig,
)

BASELINE = "baseline"


async def _latest(session: AsyncSession) -> dict[str, ForecastModelSetting]:
    rows = (
        (await session.execute(select(ForecastModelSetting).order_by(ForecastModelSetting.id)))
        .scalars()
        .all()
    )
    return {row.model_code: row for row in rows}  # the newest row of each model wins


async def disabled_models(session: AsyncSession) -> tuple[str, ...]:
    """The codes of the models that are currently switched off."""
    latest = await _latest(session)
    return tuple(sorted(code for code, row in latest.items() if not row.enabled))


async def effective_config(session: AsyncSession) -> ForecastConfig:
    """The forecast settings with today's model availability applied."""
    return replace(DEFAULT_FORECAST_CONFIG, disabled_models=await disabled_models(session))


async def list_models(session: AsyncSession) -> list[dict[str, Any]]:
    """Every forecast model with its version, kind, whether it is on, and who last changed that."""
    latest = await _latest(session)
    ids = {row.changed_by for row in latest.values()}
    names = {}
    if ids:
        found = await session.execute(select(User.user_id, User.name).where(User.user_id.in_(ids)))
        names = {user_id: name for user_id, name in found.all()}
    out = []
    for code, (spec, _) in models.MODELS.items():
        row = latest.get(code)
        out.append(
            {
                "code": code,
                "name": spec.name,
                "version": spec.version,
                "kind": spec.kind,
                "description": spec.description,
                "enabled": True if row is None else row.enabled,
                "can_be_disabled": spec.kind != BASELINE,
                "last_changed_by": None
                if row is None
                else names.get(row.changed_by, row.changed_by),
                "last_changed_at": None if row is None else row.changed_at.isoformat(),
                "last_note": None if row is None else row.note,
            }
        )
    return out


async def set_model_enabled(
    session: AsyncSession, user: User, code: str, enabled: bool, note: str | None
) -> list[dict[str, Any]]:
    """
    Switch a forecast model on or off. Adds a history row and an audit entry.

    Raises:
        NotFoundError: If the model does not exist.
        ValidationError: If the model is a baseline (they must stay available).
    """
    if code not in models.MODELS:
        raise NotFoundError(f"Forecast model '{code}' was not found.")
    spec, _ = models.MODELS[code]
    if spec.kind == BASELINE and not enabled:
        raise ValidationError(
            f"'{spec.name}' is a baseline and cannot be switched off: other models are judged "
            "against the baselines."
        )
    current = (await _latest(session)).get(code)
    if (True if current is None else current.enabled) == enabled:
        return await list_models(session)  # already in that state: nothing to record
    session.add(
        ForecastModelSetting(
            model_code=code,
            enabled=enabled,
            note=(note or "").strip() or None,
            changed_by=user.user_id,
        )
    )
    audit.record(
        session,
        user,
        audit.MODEL_SETTING_CHANGED,
        "forecast_model",
        code,
        f"{spec.name} was switched {'on' if enabled else 'off'}."
        + (f" Note: {note.strip()}" if note and note.strip() else ""),
    )
    await session.commit()
    return await list_models(session)
