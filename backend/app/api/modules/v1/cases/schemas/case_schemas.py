"""
Case Lifecycle and Audit Pydantic DTO Schemas.
Pure request/response serialization — no business logic.
"""

from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class CaseHistoryResponse(BaseModel):
    """Audit log history event for a case."""

    model_config = ConfigDict(from_attributes=True)

    history_id: Optional[int] = None
    case_id: str
    actor: str
    action: str
    previous_status: Optional[str] = None
    new_status: str
    note: Optional[str] = None
    timestamp: datetime


class CaseResponse(BaseModel):
    """Full detail of a governed Risk Case."""

    model_config = ConfigDict(from_attributes=True)

    case_id: str
    case_number: str
    priority: str
    status: str
    supplier_id: str
    transaction_id: str
    assigned_to: Optional[str] = None
    trigger_signals: List[Dict[str, Any]] = []
    evaluation_snapshot: Dict[str, Any] = {}

    # 8 Mandatory Verified Closure Fields
    root_cause: Optional[str] = None
    corrective_action: Optional[str] = None
    closure_type: Optional[str] = None
    closure_evidence: Optional[str] = None
    verified_by: Optional[str] = None
    closure_date: Optional[date] = None
    follow_up_requirement: Optional[str] = None
    recurrence_monitoring: Optional[str] = None

    history: List[CaseHistoryResponse] = []
    prior_cases: List[Dict[str, Any]] = []
    created_at: datetime
    updated_at: datetime


class CaseTransitionRequest(BaseModel):
    """Request payload for state machine transitions."""

    to_status: str = Field(..., description="Target status in case lifecycle")
    actor: str = Field(..., description="User or service performing transition")
    note: Optional[str] = Field(None, description="Investigation or transition notes")
    assigned_to: Optional[str] = Field(None, description="Assigned investigator")

    # 8 Verified Closure Fields (Mandatory when to_status == 'Closed')
    root_cause: Optional[str] = None
    corrective_action: Optional[str] = None
    closure_type: Optional[
        Literal[
            "Confirmed Fraud / Blocked",
            "Process Error / Remedied",
            "Legitimate Exception Approved",
            "False Positive / Threshold Adjusted",
        ]
    ] = None
    closure_evidence: Optional[str] = None
    verified_by: Optional[str] = None
    closure_date: Optional[date] = None
    follow_up_requirement: Optional[str] = None
    recurrence_monitoring: Optional[str] = None
