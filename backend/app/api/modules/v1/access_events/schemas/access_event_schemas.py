"""
Access Event Validation and Response DTO Schemas.
"""

from datetime import datetime

from pydantic import BaseModel


class AccessEventResponse(BaseModel):
    event_id: str
    user_id: str
    event_time: datetime
    system: str
    action: str
    resource: str
    supplier_id: str | None = None
    result: str
    location_context: str | None = None
    notes: str | None = None
    flagged: bool
    created_at: datetime


class AccessEventStatsResponse(BaseModel):
    total_events: int
    off_hours_events: int
    unique_users: int
    unique_systems: int
