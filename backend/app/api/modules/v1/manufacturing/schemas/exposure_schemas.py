"""Request schemas for what-if scenarios. Unknown fields and wild values are refused."""

from pydantic import BaseModel, ConfigDict, Field

from app.api.modules.v1.manufacturing.service.exposure_types import Scenario


class ScenarioInputs(BaseModel):
    """The what-if adjustments. Every field defaults to no change."""

    model_config = ConfigDict(extra="forbid")

    price_change_pct: float = Field(0, ge=-90, le=500, description="Forecast price change, %")
    demand_change_pct: float = Field(0, ge=-100, le=500, description="Expected usage change, %")
    lead_time_delay_days: float = Field(0, ge=0, le=365, description="Added lead time, days")
    inventory_change_pct: float = Field(0, ge=-100, le=500, description="Stock on hand change, %")
    supplier_id: str | None = Field(None, max_length=50)
    supplier_price_change_pct: float = Field(0, ge=-90, le=500)
    spot_premium_pct: float = Field(0, ge=0, le=500, description="Premium on uncovered usage, %")

    def to_scenario(self) -> Scenario:
        return Scenario(**self.model_dump())


class ScenarioRequest(BaseModel):
    """A scenario to apply to the stored forecasts of one material, or of all materials."""

    model_config = ConfigDict(extra="forbid")

    horizon_days: int = Field(30)
    material_id: str | None = Field(None, max_length=50)
    scenario: ScenarioInputs
