from datetime import datetime

from fastapi import APIRouter, Depends, Query, status

from SourceCode.BE.app.dependencies.sql_database import SessionDep
from SourceCode.BE.app.dependencies.user import allow_admin
from SourceCode.BE.app.schemas.audit_schema import AuditLogHistoryResponse, AuditLogQuery
from SourceCode.BE.app.schemas.base_schema import BaseResponse
from SourceCode.BE.app.services import audit_service

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("/", response_model=BaseResponse[AuditLogHistoryResponse], dependencies=[Depends(allow_admin)])
async def read_audit_logs(
    session: SessionDep,
    actor_id: int | None = Query(None),
    actor_username: str | None = Query(None),
    action: str | None = Query(None),
    target_type: str | None = Query(None),
    target_id: str | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    query = AuditLogQuery(
        actor_id=actor_id,
        actor_username=actor_username,
        action=action,
        target_type=target_type,
        target_id=target_id,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit,
    )
    result = audit_service.get_audit_logs(session, query)

    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Audit logs retrieved successfully",
        result=result,
    )
