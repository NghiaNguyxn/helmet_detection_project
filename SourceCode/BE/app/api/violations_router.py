from datetime import datetime
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status, Response
from motor.motor_asyncio import AsyncIOMotorCollection

from SourceCode.BE.app.dependencies.nosql_database import get_violation_collection
from SourceCode.BE.app.dependencies.sql_database import SessionDep
from SourceCode.BE.app.dependencies.user import allow_admin, allow_any_staff
from SourceCode.BE.app.exceptions.violation import ViolationNotFoundError
from SourceCode.BE.app.schemas.helmet_schema import (
    ViolationHistoryResponse,
    ViolationConfirmRequest, 
    ViolationRecord,
    ViolationRejectRequest
)
from SourceCode.BE.app.schemas.base_schema import BaseResponse
from SourceCode.BE.app.services import audit_service
from SourceCode.BE.app.services import violation_service
from SourceCode.BE.app.models.user import UserDB
from SourceCode.BE.app.utils import time as time_utils

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
    status_filter: Literal["all", "pending", "confirmed", "rejected"] = Query(
        "all",
        alias="status",
        description="Filter by violation status: all, pending, confirmed, rejected"
    ),
    camera_code: str | None = Query(
        "all",
        alias="camera_code",
        description="Filter by camera code, or all"
    ),
    sort_by: str = Query("timestamp"),
    order: str = Query("desc"),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection),
):
    """
    Get paginated and filtered violation history from MongoDB.
    """
    response = await violation_service.get_violation_history(
        db_collection=db_collection, 
        page=page, 
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        min_violations=min_violations,
        only_violations=only_violations,
        status=status_filter,
        camera_code=camera_code,
        sort_by=sort_by,
        order=order
    )
    return BaseResponse(code=status.HTTP_200_OK, result=response)

@router.patch(
    "/{violation_id}/confirm",
    response_model=BaseResponse[ViolationRecord],
)
async def confirm_violation(
    request: ViolationConfirmRequest,
    session: SessionDep,
    http_request: Request,
    violation_id: str = Path(..., description="ID of the violation to confirm"),
    reviewer: UserDB = Depends(allow_any_staff),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection),
):
    """Confirm a violation record (Staff and Admin)"""

    violation = await violation_service.confirm_violation(
        db_collection=db_collection,
        violation_id=violation_id,
        review_note=request.review_note,
        reviewer=reviewer,
    )
    if not violation:
        raise ViolationNotFoundError()
    audit_service.create_log(
        session=session,
        action="violation.confirmed",
        actor=reviewer,
        target_type="violation",
        target_id=violation_id,
        description=f"Confirmed violation {violation_id}",
        ip_address=audit_service.request_ip(http_request),
        metadata={
            "new_status": "confirmed",
            "review_note": request.review_note,
        },
    )
    
    return BaseResponse(
        code=status.HTTP_200_OK, 
        message="Violation confirmed successfully", 
        result=violation
    )

@router.patch(
    "/{violation_id}/reject",
    response_model=BaseResponse[ViolationRecord],
)
async def reject_violation(
    request: ViolationRejectRequest,
    session: SessionDep,
    http_request: Request,
    violation_id: str = Path(..., description="ID of the violation to reject"),
    reviewer: UserDB = Depends(allow_any_staff),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection),
):
    """Reject a violation record (Staff and Admin)"""

    violation = await violation_service.reject_violation(
        db_collection=db_collection,
        violation_id=violation_id,
        rejection_reason=request.rejection_reason,
        review_note=request.review_note,
        reviewer=reviewer,
    )
    if not violation:
        raise ViolationNotFoundError()
    audit_service.create_log(
        session=session,
        action="violation.rejected",
        actor=reviewer,
        target_type="violation",
        target_id=violation_id,
        description=f"Rejected violation {violation_id}",
        ip_address=audit_service.request_ip(http_request),
        metadata={
            "new_status": "rejected",
            "rejection_reason": request.rejection_reason.value,
            "review_note": request.review_note,
        },
    )
    
    return BaseResponse(
        code=status.HTTP_200_OK, 
        message="Violation rejected successfully", 
        result=violation
    )

@router.delete("/{violation_id}")
async def delete_violation(
    violation_id: str,
    session: SessionDep,
    request: Request,
    admin_user: UserDB = Depends(allow_admin),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection)
):
    """Delete a violation record (Admin Only)"""

    success = await violation_service.delete_violation(db_collection, violation_id)
    if not success:
        raise ViolationNotFoundError()
    audit_service.create_log(
        session=session,
        action="violation.deleted",
        actor=admin_user,
        target_type="violation",
        target_id=violation_id,
        description=f"Deleted violation {violation_id}",
        ip_address=audit_service.request_ip(request),
    )
        
    return BaseResponse(code=status.HTTP_200_OK, message="Violation record deleted successfully")

@router.get("/export", dependencies=[Depends(allow_any_staff)])
async def export_violation_history(
    start_date: datetime = Query(None),
    end_date: datetime = Query(None),
    min_violations: int = Query(None),
    only_violations: bool = Query(False),
    status_filter: Literal["all", "pending", "confirmed", "rejected"] = Query(
        "all",
        alias="status",
        description="Filter by violation status: all, pending, confirmed, rejected"
    ),      
    camera_code: str | None = Query(
        "all",
        alias="camera_code",
        description="Filter by camera code, or all"
    ),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection)
):
    """Export filtered violation history to Excel"""

    excel_buffer = await violation_service.export_violations_to_excel(
        db_collection=db_collection,
        start_date=start_date,
        end_date=end_date,
        min_violations=min_violations,
        only_violations=only_violations,
        status=status_filter,
        camera_code=camera_code,
    )
    
    filename = f"violation_report_{time_utils.utc_now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return Response(
        content=excel_buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )

@router.get("/export-feedback-dataset", dependencies=[Depends(allow_any_staff)])
async def export_feedback_dataset(
    start_date: datetime = Query(None),
    end_date: datetime = Query(None),
    status_filter: Literal["all", "confirmed", "rejected"] = Query(
        "all",
        alias="status",
        description="Export reviewed feedback by status: all, confirmed, rejected"
    ),
    rejection_reason: Literal[
        "all",
        "false_positive",
        "helmet_detected_incorrectly",
        "person_not_riding_motorcycle",
        "image_too_blurry",
        "duplicate_violation",
        "other"
    ] = Query("all", description="Filter rejected feedback by reason"),
    include_images: bool = Query(True, description="Download evidence images into the ZIP"),
    limit: int = Query(
        500,
        ge=1,
        le=2000,
        description="Maximum reviewed records to export. Keeps ZIP generation bounded."
    ),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection)
):
    """Export reviewed violations as an AI feedback dataset ZIP."""

    if status_filter == "confirmed" and rejection_reason != "all":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="rejection_reason can only be used with status=all or status=rejected"
        )

    dataset_buffer = await violation_service.export_feedback_dataset(
        db_collection=db_collection,
        start_date=start_date,
        end_date=end_date,
        status=status_filter,
        rejection_reason=rejection_reason,
        include_images=include_images,
        limit=limit,
    )

    filename = f"ai_feedback_dataset_{time_utils.utc_now().strftime('%Y%m%d_%H%M%S')}.zip"

    return Response(
        content=dataset_buffer.getvalue(),
        media_type="application/zip",
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )
    
