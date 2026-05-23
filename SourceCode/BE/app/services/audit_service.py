import logging
from datetime import datetime
from typing import Any

from sqlalchemy import func as sa_func
from sqlmodel import Session, and_, select

from SourceCode.BE.app.models.audit_log import AuditLogDB
from SourceCode.BE.app.models.user import UserDB
from SourceCode.BE.app.schemas.audit_schema import AuditLogHistoryResponse, AuditLogQuery

logger = logging.getLogger(__name__)


def create_log(
    session: Session,
    action: str,
    actor: UserDB | None = None,
    target_type: str | None = None,
    target_id: str | int | None = None,
    description: str | None = None,
    ip_address: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLogDB | None:
    """Persist an audit log entry without breaking the business action if logging fails."""

    try:
        log_entry = AuditLogDB(
            actor_id=actor.id if actor else None,
            actor_username=actor.username if actor else None,
            actor_role=actor.role.value if actor and actor.role else None,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            description=description,
            ip_address=ip_address,
            metadata_json=metadata,
        )
        session.add(log_entry)
        session.commit()
        session.refresh(log_entry)
        return log_entry
    except Exception as exc:
        session.rollback()
        logger.warning("Failed to write audit log for action=%s target=%s:%s: %s", action, target_type, target_id, exc)
        return None


def get_audit_logs(session: Session, query: AuditLogQuery) -> AuditLogHistoryResponse:
    filters = []

    if query.actor_id is not None:
        filters.append(AuditLogDB.actor_id == query.actor_id)
    if query.actor_username:
        filters.append(AuditLogDB.actor_username.ilike(f"%{query.actor_username}%"))
    if query.action:
        filters.append(AuditLogDB.action == query.action)
    if query.target_type:
        filters.append(AuditLogDB.target_type == query.target_type)
    if query.target_id:
        filters.append(AuditLogDB.target_id == query.target_id)
    if query.start_date:
        filters.append(AuditLogDB.created_at >= query.start_date)
    if query.end_date:
        filters.append(AuditLogDB.created_at <= query.end_date)

    where_clause = and_(*filters) if filters else None
    count_statement = select(sa_func.count(AuditLogDB.id))
    data_statement = select(AuditLogDB).order_by(AuditLogDB.created_at.desc(), AuditLogDB.id.desc())

    if where_clause is not None:
        count_statement = count_statement.where(where_clause)
        data_statement = data_statement.where(where_clause)

    total = session.exec(count_statement).one()
    offset = (query.page - 1) * query.limit
    logs = session.exec(data_statement.offset(offset).limit(query.limit)).all()

    return AuditLogHistoryResponse(
        total=total,
        page=query.page,
        limit=query.limit,
        data=logs,
    )


def request_ip(request) -> str | None:
    if not request or not request.client:
        return None
    return request.client.host
