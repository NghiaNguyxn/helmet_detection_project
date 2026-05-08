from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorCollection
from datetime import date

from SourceCode.BE.app.dependencies.nosql_database import get_violation_collection, get_traffic_stats_collection
from SourceCode.BE.app.dependencies.user import allow_admin, allow_any_staff
from SourceCode.BE.app.schemas.base_schema import BaseResponse
from SourceCode.BE.app.schemas.report_schema import SummaryReportResponse, TrendReportResponse
from SourceCode.BE.app.services import report_service

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/summary",
            response_model=BaseResponse[SummaryReportResponse],
            dependencies=[Depends(allow_any_staff)])
async def get_summary_report(
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection),
    traffic_collection: AsyncIOMotorCollection = Depends(get_traffic_stats_collection),
):
    """Summary report: total number of violations, breakdown by day and time."""

    result = await report_service.get_summary_report(
        collection=db_collection,
        traffic_collection=traffic_collection,
        start_date=start_date,
        end_date=end_date
    )

    return BaseResponse(
        code=status.HTTP_200_OK,
        result=result
    )

@router.get("/trend",
            response_model=BaseResponse[TrendReportResponse],
            dependencies=[Depends(allow_any_staff)])
async def get_trend_report(
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    granularity: str = Query("day", pattern="^(day|hour)$", description="day or hour"),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection),
    traffic_collection: AsyncIOMotorCollection = Depends(get_traffic_stats_collection)
):
    """Trend data for plotting charts (line/bar)"""

    result = await report_service.get_trend_report(
        start_date=start_date,
        end_date=end_date,
        granularity=granularity,
        collection=db_collection,
        traffic_collection=traffic_collection
    )

    return BaseResponse(
        code=status.HTTP_200_OK,
        result=result
    )