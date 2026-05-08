from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SecurityAlert(BaseModel):
    id: Optional[str] = None
    sender_name: str
    message: str
    camera_id: str
    timestamp: datetime

class SecurityAlertCreate(BaseModel):
    message: str
    camera_id: str
