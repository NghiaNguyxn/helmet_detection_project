from datetime import datetime
from fastapi import APIRouter, Depends, Query, status, Response
from motor.motor_asyncio import AsyncIOMotorCollection

from SourceCode.BE.app.dependencies.nosql_database import get_violation_collection
from SourceCode.BE.app.dependencies.user import allow_admin, allow_any_staff
from SourceCode.BE.app.schemas.helmet_schema import ViolationHistoryResponse
from SourceCode.BE.app.schemas.base_schema import BaseResponse
from SourceCode.BE.app.services import violation_services

router = APIRouter(prefix="/violations", tags=["Violations History"])

@router.get(
    "/",
    response_model=BaseResponse[ViolationHistoryResponse],
    dependencies=[Depends(allow_any_staff)])
async def get_violation_history(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Records per page"),
    start_date: datetime = Query(None),
    end_date: datetime = Query(None),
    min_violations: int = Query(None),
    only_violations: bool = Query(False),
    sort_by: str = Query("timestamp"),
    order: str = Query("desc"),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection),
):
    """
    Get paginated and filtered violation history from MongoDB.
    """
    response = await violation_services.get_violation_history(
        db_collection=db_collection, 
        page=page, 
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        min_violations=min_violations,
        only_violations=only_violations,
        sort_by=sort_by,
        order=order
    )
    return BaseResponse(code=status.HTTP_200_OK, result=response)

@router.delete("/{violation_id}", dependencies=[Depends(allow_admin)])
async def delete_violation(
    violation_id: str,
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection)
):
    """Delete a violation record (Admin Only)"""

    success = await violation_services.delete_violation(db_collection, violation_id)
    if not success:
        return BaseResponse(code=status.HTTP_404_NOT_FOUND, message="Violation record not found")
    return BaseResponse(code=status.HTTP_200_OK, message="Violation record deleted successfully")

@router.get("/export", dependencies=[Depends(allow_any_staff)])
async def export_violation_history(
    start_date: datetime = Query(None),
    end_date: datetime = Query(None),
    min_violations: int = Query(None),
    only_violations: bool = Query(False),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection)
):
    """Export filtered violation history to Excel"""

    excel_buffer = await violation_services.export_violations_to_excel(
        db_collection=db_collection,
        start_date=start_date,
        end_date=end_date,
        min_violations=min_violations,
        only_violations=only_violations
    )
    
    filename = f"violation_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return Response(
        content=excel_buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )
    