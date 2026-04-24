from typing import Annotated, Optional
from fastapi import Depends, HTTPException, status, Request, WebSocket
from starlette.requests import HTTPConnection
from sqlmodel import Session

from SourceCode.BE.app.dependencies.sql_database import SessionDep
from SourceCode.BE.app.core import security
from SourceCode.BE.app.exceptions import auth as auth_exceptions
from SourceCode.BE.app.services import user_service
from SourceCode.BE.app.exceptions import user as user_exceptions
from SourceCode.BE.app.models.user import UserDB
from SourceCode.BE.app.enum.user_role import UserRole

async def get_current_user(
        request: HTTPConnection,
        db : SessionDep
):
    """
    Get the current user from the token.
    Supports both Header (Authorization: Bearer <token>) and Query Parameter (?token=<token>).
    """
    
    token = None
    
    # 1. Try to get token from Authorization Header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        
    # 2. If not in Header, try to get from Query Parameter (Common for WebSockets)
    if not token:
        token = request.query_params.get("token")
        
    # 3. If still no token, raise authentication error
    if not token:
        raise auth_exceptions.NotAuthenticatedError()

    # 4. Verify the token content
    token_data = security.verify_token(token)
    if token_data is None:
        raise auth_exceptions.NotAuthenticatedError()
    
    # 5. Fetch user from database
    user = user_service.get_user_by_username_or_email(db, token_data.username)
    if user is None:
        raise user_exceptions.UserNotFound()
    
    return user

async def get_current_active_user(
        current_user: Annotated[UserDB, Depends(get_current_user)]
):
    """Check if the current user is active"""

    if not current_user.is_active:
        raise user_exceptions.UserInactive()
    
    return current_user

async def get_current_verified_user(
        current_user: Annotated[UserDB, Depends(get_current_active_user)]
):
    """Check if the current user is verified"""

    if not current_user.is_verified:
        raise user_exceptions.UserNotVerified()
    
    return current_user

CurrentUser = Annotated[UserDB, Depends(get_current_user)]
ActiveUser = Annotated[UserDB, Depends(get_current_active_user)]
VerifiedUser = Annotated[UserDB, Depends(get_current_verified_user)]

class RoleChecker:
    def __init__(self, allowed_roles: list[UserRole]):
        self.allowed_roles = allowed_roles

    async def __call__(self, current_user: ActiveUser):
        if current_user.role not in self.allowed_roles:
            raise auth_exceptions.PermissionDenied()
        
        return current_user
    
allow_admin = RoleChecker(allowed_roles=[UserRole.ADMIN])
allow_any_staff = RoleChecker(allowed_roles=[UserRole.ADMIN, UserRole.GUARD])