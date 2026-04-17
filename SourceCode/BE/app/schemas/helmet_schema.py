from pydantic import BaseModel
from datetime import datetime

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

class ViolationHistoryResponse(BaseModel):
    total: int
    page: int
    limit: int
    data: list[ViolationRecord]