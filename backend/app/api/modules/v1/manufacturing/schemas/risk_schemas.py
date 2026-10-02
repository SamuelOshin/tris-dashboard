"""Request schemas for material risk scoring weights. Shape only; the business rules (weights add
up to 100, bands increase) are checked by the scoring engine."""

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StrictFloat, StrictInt

# Real numbers only: no booleans, no NaN or infinity (the engine checks again).
Number = StrictInt | Annotated[StrictFloat, Field(allow_inf_nan=False)]


class WeightSetConfig(BaseModel):
    """Weights, scales and bands of one weight set version."""

    model_config = ConfigDict(extra="forbid")

    weights: dict[str, Number]
    ramps: dict[str, list[Number]]
    bands: dict[str, Number]
    min_evaluable_weight: Number


class WeightSetRequest(BaseModel):
    """A new weight set version, with the reason for the change."""

    model_config = ConfigDict(extra="forbid")

    config: WeightSetConfig
    note: str = Field(min_length=5, max_length=500)

    def config_dict(self) -> dict[str, Any]:
        return self.config.model_dump()
