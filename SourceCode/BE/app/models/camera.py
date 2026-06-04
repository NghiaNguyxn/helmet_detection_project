from datetime import datetime

from sqlmodel import DateTime, Field, SQLModel, func

from SourceCode.BE.app.enums.camera_source_type import CameraSourceType


class CameraDB(SQLModel, table=True):
    __tablename__: str = "cameras"

    id: int | None = Field(default=None, primary_key=True, index=True)
    code: str = Field(unique=True, index=True, nullable=False)
    name: str = Field(nullable=False)
    source_type: CameraSourceType = Field(default=CameraSourceType.WEBCAM, nullable=False, index=True)
    source_url: str = Field(nullable=False)
    location: str | None = Field(default=None)
    is_active: bool = Field(default=True, index=True)
    last_status: str = Field(default="unchecked", nullable=False, index=True)
    last_checked_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    is_deleted: bool = Field(default=False, index=True)
    deleted_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    created_at: datetime = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={"server_default": func.now()},
    )
    updated_at: datetime = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={
            "onupdate": func.now(),
            "server_default": func.now(),
        },
    )
