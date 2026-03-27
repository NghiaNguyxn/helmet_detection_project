from pydantic import BaseModel
from typing import List

class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class Detection(BaseModel):
    class_id: int
    confidence: float
    bbox: BoundingBox


class PredictResponse(BaseModel):
    detections: List[Detection]
    total_detections: int
    image_base64: str