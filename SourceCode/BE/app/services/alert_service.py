from datetime import datetime
from sqlmodel import Session, select
from SourceCode.BE.app.models.alert import SecurityAlert
from SourceCode.BE.app.schemas.alert_schema import SecurityAlertCreate
from SourceCode.BE.app.core.websocket_manager import manager
from SourceCode.BE.app.dependencies.user import VerifiedUser

async def create_and_broadcast_alert(session: Session, user: VerifiedUser, alert_in: SecurityAlertCreate):
    """
    Create a new security alert in SQL and broadcast via WebSocket
    """
    db_alert = SecurityAlert(
        user_id=user.id,
        message=alert_in.message,
        camera_id=alert_in.camera_id,
        timestamp=datetime.now()
    )
    
    session.add(db_alert)
    session.commit()
    session.refresh(db_alert)
    
    # Prepare payload for real-time display
    alert_data = {
        "id": db_alert.id,
        "sender_name": user.full_name or user.username,
        "message": db_alert.message,
        "camera_id": db_alert.camera_id,
        "timestamp": db_alert.timestamp.isoformat()
    }
    
    # Broadcast via WebSocket
    await manager.broadcast({
        "event": "security_alert",
        "data": alert_data
    })
    
    return alert_data

async def get_recent_alerts(session: Session, limit: int = 10):
    """
    Retrieve recent alerts with sender information
    """
    statement = select(SecurityAlert).order_by(SecurityAlert.timestamp.desc()).limit(limit)
    results = session.exec(statement).all()
    
    alerts_with_sender = []
    for alert in results:
        alerts_with_sender.append({
            "id": alert.id,
            "sender_name": alert.user.full_name or alert.user.username if alert.user else "Unknown",
            "message": alert.message,
            "camera_id": alert.camera_id,
            "timestamp": alert.timestamp
        })
        
    return alerts_with_sender
