"""
Rule Engine Pydantic DTO Schemas.
Pure request/response serialization — no business logic.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class RuleConfigResponse(BaseModel):
    """Detection rule configuration DTO."""

    model_config = ConfigDict(from_attributes=True)

    rule_id: Optional[int] = None
    rule_code: str
    name: str
    description: str
    weight: int
    threshold_params: Dict[str, Any]
    rule_version: int
    is_active: bool
    updated_at: datetime


class RuleConfigUpdate(BaseModel):
    """Payload to update detection rule thresholds or weight."""

    name: Optional[str] = None
    description: Optional[str] = None
    weight: Optional[int] = Field(None, ge=0, le=100)
    threshold_params: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class RuleEvaluationSignal(BaseModel):
    """Detailed result of evaluating an individual rule against a transaction."""

    rule_code: str
    rule_name: str
    rule_version: int
    triggered: bool
    weight: int
    score: int
    explanation: str
    diagnostics: Dict[str, Any] = {}


class EvaluationResult(BaseModel):
    """Composite evaluation result across all active detection rules."""

    transaction_id: str
    supplier_id: str
    triggered_signals: List[RuleEvaluationSignal]
    total_score: int
    priority: str
    case_required: bool
    evaluation_snapshot: Dict[str, Any]
