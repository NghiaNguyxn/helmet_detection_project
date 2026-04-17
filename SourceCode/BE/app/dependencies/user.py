from typing import Annotated
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from SourceCode.BE.app.dependencies.sql_database import SessionDep
from SourceCode.BE.app.core import security
from SourceCode.BE.app.exceptions import auth as auth_exceptions
from SourceCode.BE.app.services import user_service
from SourceCode.BE.app.exceptions import user as user_exceptions
from SourceCode.BE.app.models.user import UserDB
from SourceCode.BE.app.enum.user_role import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

async def get_current_user(
        request: Request,
        db : SessionDep, 
        token: str = Depends(oauth2_scheme)
):
    """Get the current user from the token"""
    
    if not token:
        token = request.query_params.get("token")
        
    if not token:
        raise auth_exceptions.NotAuthenticatedError()

    token_data = security.verify_token(token)
    if token_data is None:
        raise auth_exceptions.NotAuthenticatedError()
    
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