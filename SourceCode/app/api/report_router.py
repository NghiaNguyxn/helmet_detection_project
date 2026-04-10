from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorCollection
from datetime import date

from app.dependencies.nosql_database import get_violation_collection
from app.dependencies.user import allow_admin, allow_any_staff
from app.schemas.base_schema import BaseResponse
from app.schemas.report_schema import SummaryReportResponse, TrendReportResponse
from app.services import report_service
from app.utils.export_report import export_violations_to_excel

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/summary",
            response_model=BaseResponse[SummaryReportResponse],
            dependencies=[Depends(allow_any_staff)])
async def get_summary_report(
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection),
):
    """Summary report: total number of violations, breakdown by day and time."""

    result = await report_service.get_summary_report(
        collection=db_collection,
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
    granularity: str = Query("day", regex="^(day|hour)$", description="day or hour"),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection)
):
    """Trend data for plotting charts (line/bar)"""

    result = await report_service.get_trend_report(
        start_date=start_date,
        end_date=end_date,
        granularity=granularity,
        collection=db_collection
    )

    return BaseResponse(
        code=status.HTTP_200_OK,
        result=result
    )

@router.get("/export/excel",
            dependencies=[Depends(allow_admin)])
async def get_summary_report(
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection),
):
    """Export the list of violations to an Excel file (admin only)."""

    excel_file = await export_violations_to_excel(db_collection, start_date, end_date)
    filename = f"violations_{start_date}_{end_date}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )