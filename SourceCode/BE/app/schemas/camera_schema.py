from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from SourceCode.BE.app.enums.camera_source_type import CameraSourceType


class CameraCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    source_type: CameraSourceType = CameraSourceType.WEBCAM
    source_url: str = Field(min_length=1, max_length=500)
    location: str | None = Field(default=None, max_length=200)
    is_active: bool = True


class CameraUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    source_type: CameraSourceType | None = None
    source_url: str | None = Field(default=None, min_length=1, max_length=500)
    location: str | None = Field(default=None, max_length=200)
    is_active: bool | None = None


class CameraResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    source_type: CameraSourceType
    source_url: str
    location: str | None = None
    is_active: bool
    last_status: str
    last_checked_at: datetime | None = None
    is_deleted: bool
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CameraSourceResponse(BaseModel):
    id: int | None = None
    code: str
    name: str
    location: str | None = None
    source_type: CameraSourceType
    is_active: bool
    last_status: str
    runtime_status: str | None = None


class CameraConnectionTestResponse(BaseModel):
    camera_id: int
    code: str
    status: str
    message: str
    checked_at: datetime
