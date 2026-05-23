from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_id: int | None = None
    actor_username: str | None = None
    actor_role: str | None = None
    action: str
    target_type: str | None = None
    target_id: str | None = None
    description: str | None = None
    ip_address: str | None = None
    metadata_json: dict[str, Any] | None = None
    created_at: datetime


class AuditLogHistoryResponse(BaseModel):
    total: int
    page: int
    limit: int
    data: list[AuditLogResponse]


class AuditLogQuery(BaseModel):
    actor_id: int | None = None
    actor_username: str | None = None
    action: str | None = None
    target_type: str | None = None
    target_id: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)
