from pydantic import BaseModel, Field
from datetime import datetime

from SourceCode.BE.app.enums.rejection_reason import RejectionReason
from SourceCode.BE.app.enums.violation_status import ViolationStatus
from SourceCode.BE.app.schemas.user_schema import ReviewUser

class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float

class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    bbox: BoundingBox
    track_id: int | None = None

class PredictResponse(BaseModel):
    detections: list[Detection]
    total_detections: int
    image_base64: str

class ViolationRecord(BaseModel):
    id: str | None = None
    timestamp: datetime
    image_url: str
    total_violations: int
    detections: list[Detection]
    status: ViolationStatus = ViolationStatus.PENDING
    reviewed_by: ReviewUser | None = None
    reviewed_at: datetime | None = None
    review_note: str | None = None
    rejection_reason: RejectionReason | None = None

class ViolationHistoryResponse(BaseModel):
    total: int
    page: int
    limit: int
    data: list[ViolationRecord]

class ViolationConfirmRequest(BaseModel):
    review_note: str | None = Field(default=None, max_length=1000)

class ViolationRejectRequest(BaseModel):
    rejection_reason: RejectionReason
    review_note: str | None = Field(default=None, max_length=1000)