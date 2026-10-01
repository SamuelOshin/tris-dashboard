"""
Pydantic request and response schemas for the ERP/BOM mapping engine.
Pure DTOs — no business logic.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

SourceProfile = Literal["generic", "sap_style", "dynamics_style"]


class MappingRunConfig(BaseModel):
    """How one uploaded file should be mapped, validated and imported."""

    target: str = Field(min_length=1, max_length=50)
    source_profile: SourceProfile = "generic"
    field_mapping: dict[str, str] = Field(default_factory=dict)
    defaults: dict[str, str] = Field(default_factory=dict)
    dataset_id: str | None = Field(default=None, max_length=100)
    duplicate_strategy: Literal["skip", "fail"] = "skip"
    sheet: str | None = Field(default=None, max_length=200)
    profile_id: str | None = Field(default=None, max_length=50)


class MappingProfileCreate(BaseModel):
    """Request body for saving a reusable mapping profile."""

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    source_profile: SourceProfile = "generic"
    target: str = Field(min_length=1, max_length=50)
    field_mapping: dict[str, str]
    defaults: dict[str, str] = Field(default_factory=dict)


class MappingProfileResponse(BaseModel):
    """A saved mapping profile."""

    profile_id: str
    name: str
    description: str | None
    source_profile: SourceProfile
    target: str
    field_mapping: dict[str, Any]
    defaults: dict[str, Any]
    created_by: str
    created_at: datetime
