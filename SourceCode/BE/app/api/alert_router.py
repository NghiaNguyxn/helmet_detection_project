from fastapi import APIRouter, Depends, Request, status
from SourceCode.BE.app.schemas.base_schema import BaseResponse
from SourceCode.BE.app.dependencies.sql_database import SessionDep
from SourceCode.BE.app.services import audit_service
from SourceCode.BE.app.services import alert_service
from SourceCode.BE.app.schemas.alert_schema import SecurityAlertCreate
from SourceCode.BE.app.dependencies.user import allow_any_staff, VerifiedUser

router = APIRouter(prefix="/alerts", tags=["Security Alerts"])

@router.post("/broadcast", response_model=BaseResponse[dict], dependencies=[Depends(allow_any_staff)])
async def broadcast_alert(
    alert_in: SecurityAlertCreate,
    user: VerifiedUser,
    session: SessionDep,
    request: Request
):
    """Broadcast a manual security alert to all connected users and save to SQL"""
    
    result = await alert_service.create_and_broadcast_alert(session, user, alert_in)
    audit_service.create_log(
        session=session,
        action="alert.manual_sent",
        actor=user,
        target_type="alert",
        target_id=result.get("id"),
        description=f"Sent manual alert for camera {alert_in.camera_id}",
        ip_address=audit_service.request_ip(request),
        metadata={
            "camera_id": alert_in.camera_id,
            "message": alert_in.message,
        },
    )
    
    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Alert broadcasted successfully",
        result=result
    )

@router.get("/history", response_model=BaseResponse[list[dict]], dependencies=[Depends(allow_any_staff)])
async def get_alerts_history(
    session: SessionDep,
    limit: int = 10
):
    """Retrieve recent manual security alerts from SQL"""
    
    result = await alert_service.get_recent_alerts(session, limit)
        
    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Alerts retrieved successfully",
        result=result
    )
