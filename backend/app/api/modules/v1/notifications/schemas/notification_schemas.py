"""
Notification Validation and Response DTO Schemas.
"""

from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    notification_id: str
    recipient_user_id: str | None = None
    recipient_role: str | None = None
    title: str
    message: str
    category: str
    severity: str
    link_url: str | None = None
    is_read: bool
    read_at: datetime | None = None
    metadata_json: dict | None = None
    created_at: datetime


class UnreadCountResponse(BaseModel):
    unread_count: int


class NotificationCreateRequest(BaseModel):
    title: str
    message: str
    category: str = "SYSTEM"
    severity: str = "INFO"
    recipient_user_id: str | None = None
    recipient_role: str | None = None
    link_url: str | None = None
    metadata_json: dict | None = None
