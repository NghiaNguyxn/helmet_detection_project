from fastapi import APIRouter, status

from app.services import user_service
from app.dependencies.sql_database import SessionDep
from app.core.config import setting
from app.schemas import user_schema, auth_schema
from app.schemas.base_schema import BaseResponse
from app.dependencies.user import CurrentUser, ActiveUser, VerifiedUser 

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=BaseResponse[user_schema.UserResponse])
async def read_users_me(
    current_user: CurrentUser
):
    """Get current authenticated user details"""

    return BaseResponse(
        code=status.HTTP_200_OK,
        result=current_user
    )

@router.patch("/me", response_model=BaseResponse[user_schema.UserResponse])
async def update_user_me(
    user_update: user_schema.UserUpdate,
    current_user: CurrentUser,
    session: SessionDep
):
    """Update current authenticated user's details"""

    user = user_service.update_user(session, current_user.id, user_update)

    return BaseResponse(
        code=status.HTTP_200_OK,
        result=user
    )

@router.post("/change-password")
async def change_password(
    request: auth_schema.ChangePasswordRequest,
    current_user: CurrentUser,
    session: SessionDep
):
    """Change current authenticated user's password"""

    user_service.change_password(session, current_user.id, request.current_password, request.new_password)

    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Password changed successfully"
    )