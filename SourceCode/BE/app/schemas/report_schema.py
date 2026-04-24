from datetime import datetime, date
from typing import Any, Optional
from pydantic import BaseModel

class DailyViolationCount(BaseModel):
    date: str # YYYY-MM-DD
    count: int

class HourlyViolationCount(BaseModel):
    hour: int # 0-23
    count: int

class SummaryReportResponse(BaseModel):
    total_violations: int
    total_detections: int
    accuracy: float
    peak_hour: Optional[str] = None
    start_date: date
    end_date: date
    daily_breakdown: list[DailyViolationCount]
    hourly_breakdown: Optional[list[HourlyViolationCount]] = None

class TrendReportResponse(BaseModel):
    labels: list[str]  # dates or hours
    datasets: dict[str, list[float]]  # vd: {"violations": [1,2,3], "accuracy": [98.5, 99.0]}

class ExportReportRequest(BaseModel):
    start_date: date
    end_date: date
    format: str  # "excel" or "pdf"
