"""Request schema for starting a validation run. Shape and sensible ranges only."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.modules.v1.manufacturing.service.validation_types import ValidationConfig


class RunValidationRequest(BaseModel):
    """The settings of a validation run. Every field has a default; every value is stored."""

    model_config = ConfigDict(extra="forbid")

    horizons_days: list[Literal[30, 90]] = Field(default=[30, 90], min_length=1, max_length=2)
    cutoff_step_months: int = Field(default=1, ge=1, le=12)
    event_threshold_pct: float = Field(default=5.0, gt=0, le=100, allow_inf_nan=False)
    alert_threshold: float | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    flat_band_pct: float = Field(default=0.5, ge=0, le=10, allow_inf_nan=False)
    dataset_id: str | None = Field(default=None, max_length=100)
    material_ids: list[str] = Field(default=[], max_length=200)
    note: str | None = Field(default=None, max_length=500)

    def to_config(self) -> ValidationConfig:
        return ValidationConfig(
            horizons_days=tuple(sorted(set(self.horizons_days))),
            cutoff_step_months=self.cutoff_step_months,
            event_threshold_pct=self.event_threshold_pct,
            alert_threshold=self.alert_threshold,
            flat_band_pct=self.flat_band_pct,
            dataset_id=self.dataset_id,
            material_ids=tuple(self.material_ids),
        )
