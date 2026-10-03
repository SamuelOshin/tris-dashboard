"""Request schema for opening or linking a material-cost case. Shape only."""

from pydantic import BaseModel, ConfigDict, Field


class OpenMaterialCaseRequest(BaseModel):
    """Open a case from a stored risk score, or link the score to an existing open case."""

    model_config = ConfigDict(extra="forbid")

    score_id: str = Field(min_length=1, max_length=50)
    link_case_id: str | None = Field(default=None, max_length=50)
    note: str | None = Field(default=None, max_length=500)
