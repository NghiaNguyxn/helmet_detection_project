from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship, func
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .user import UserDB

class SecurityAlert(SQLModel, table=True):
    __tablename__: str = "security_alerts"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    message: str = Field(nullable=False)
    camera_id: str = Field(nullable=False)
    timestamp: datetime = Field(
        default=None,
        sa_column_kwargs={"server_default": func.now()}
    )
    
    user_id: int = Field(foreign_key="users.id")
    
    # Relationship to user
    user: Optional["UserDB"] = Relationship()
