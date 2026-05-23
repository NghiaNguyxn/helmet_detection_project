from datetime import datetime
from typing import Any

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel, func


class AuditLogDB(SQLModel, table=True):
    __tablename__: str = "audit_logs"

    id: int | None = Field(default=None, primary_key=True, index=True)
    actor_id: int | None = Field(default=None, index=True)
    actor_username: str | None = Field(default=None, index=True)
    actor_role: str | None = Field(default=None, index=True)
    action: str = Field(nullable=False, index=True)
    target_type: str | None = Field(default=None, index=True)
    target_id: str | None = Field(default=None, index=True)
    description: str | None = Field(default=None)
    ip_address: str | None = Field(default=None)
    metadata_json: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    created_at: datetime = Field(
        default=None,
        index=True,
        sa_column_kwargs={"server_default": func.now()},
    )
