from datetime import datetime
from sqlmodel import SQLModel, Field, func, DateTime

from SourceCode.BE.app.enums.user_role import UserRole

# BASE MODELS
class UserBase(SQLModel):
    username: str = Field(unique=True, index=True, nullable=False)
    email: str = Field(unique=True, index=True, nullable=False)
    full_name: str | None = Field(default=None)
    role: UserRole = Field(default=UserRole.GUARD, nullable=False)
    avatar_url: str | None = Field(default=None)

# TABLE MODELS
class UserDB(UserBase, table=True):
    __tablename__: str = "users"

    id: int | None = Field(default=None, primary_key=True, index=True)
    hashed_password: str = Field(nullable=False)
    is_active: bool = Field(default=True)
    is_verified: bool = Field(default=False)
    verification_token: str | None = Field(default=None)
    reset_token: str | None = Field(default=None)
    reset_token_expires: datetime | None = Field(default=None)

    # Sử dụng sa_column để dùng các tính năng đặc biệt của SQLAlchemy
    created_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=False),
        sa_column_kwargs={"server_default": func.now()}
    )
    updated_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=False),
        sa_column_kwargs={
            "onupdate": func.now(),
            "server_default": func.now()
        }
    )
