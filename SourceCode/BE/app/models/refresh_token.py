from datetime import datetime

from sqlmodel import DateTime, SQLModel, Field, func

class RefreshToken(SQLModel, table=True):
    __tablename__: str = "refresh_tokens"

    id: int | None = Field(default=None, primary_key=True, index=True)
    user_id: int = Field(nullable=False, index=True, foreign_key="users.id")
    token_hash: str = Field(nullable=False, index=True, unique=True, max_length=64)
    expires_at: datetime = Field(
        nullable=False, 
        index=True,
        sa_type=DateTime(timezone=True)
    )
    revoked_at: datetime | None = Field(
        default=None, 
        index=True,
        sa_type=DateTime(timezone=True)
    )
    replaced_by: str | None = Field(default=None, max_length=64)
    user_agent: str | None = Field(default=None)
    ip_address: str | None = Field(default=None, max_length=100)
    created_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={
            "server_default": func.now(),
            "nullable": False
        }
    )
    last_used_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),
    )
