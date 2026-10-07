"""Request schemas for the administration endpoints. Shape only."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ModelSettingRequest(BaseModel):
    """Switch a forecast model on or off, with an optional reason."""

    model_config = ConfigDict(extra="forbid")

    enabled: bool
    note: str | None = Field(default=None, max_length=500)


class DatasetLabelRequest(BaseModel):
    """Say whether a dataset is synthetic or authorised data."""

    model_config = ConfigDict(extra="forbid")

    label: Literal["unlabelled", "synthetic", "authorized"]
