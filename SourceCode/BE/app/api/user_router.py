from fastapi import APIRouter, status, Depends, File, UploadFile

from SourceCode.BE.app.schemas import auth_schema
from SourceCode.BE.app.services import user_service
from SourceCode.BE.app.dependencies.sql_database import SessionDep
from SourceCode.BE.app.schemas import user_schema
from SourceCode.BE.app.schemas.base_schema import BaseResponse
from SourceCode.BE.app.dependencies.user import ActiveUser, VerifiedUser, allow_admin

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=BaseResponse[user_schema.UserResponse])
async def read_users_me(
    current_user: ActiveUser
):
    """Get current authenticated user details"""

    return BaseResponse(
        code=status.HTTP_200_OK,
        result=current_user
    )

@router.get("/", response_model=BaseResponse[list[user_schema.UserResponse]], dependencies=[Depends(allow_admin)])
async def read_users(
    session: SessionDep,
    skip: int = 0,
    limit: int = 100
):
    """Get all users (Admin only)"""
    
    users = user_service.get_users(session, skip=skip, limit=limit)
    return BaseResponse(
        code=status.HTTP_200_OK,
        result=users
    )

@router.patch("/me", response_model=BaseResponse[user_schema.UserResponse])
async def update_user_me(
    user_update: user_schema.UserUpdate,
    current_user: ActiveUser,
    session: SessionDep
):
    """Update current authenticated user's details"""

    user = user_service.update_user(session, current_user.id, user_update)

    return BaseResponse(
        code=status.HTTP_200_OK,
        result=user,
        message="User updated successfully"
    )

@router.patch("/me/avatar", response_model=BaseResponse[user_schema.UserResponse])
async def update_user_avatar(
    current_user: ActiveUser,
    session: SessionDep,
    file: UploadFile = File(...)
):
    """Update current authenticated user's avatar"""
    user = await user_service.update_avatar(session, current_user.id, file)
    
    return BaseResponse(
        code=status.HTTP_200_OK,
        result=user,
        message="Avatar updated successfully"
    )

@router.post("/change-password")
async def change_password(
    request: auth_schema.ChangePasswordRequest,
    current_user: VerifiedUser,
    session: SessionDep
):
    """Change current authenticated user's password"""

    user_service.change_password(session, current_user.id, request.current_password, request.new_password)

    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Password changed successfully"
    )

@router.patch("/{user_id}/status", response_model=BaseResponse[user_schema.UserResponse], dependencies=[Depends(allow_admin)])
async def admin_update_user_status(
    user_id: int,
    is_active: bool,
    session: SessionDep
):
    """Update user status (Admin only)"""
    
    user = user_service.update_status(session, user_id, is_active)

    return BaseResponse(
        code=status.HTTP_200_OK, 
        result=user,
        message="User status updated successfully"
    )

@router.delete("/{user_id}", response_model=BaseResponse[bool], dependencies=[Depends(allow_admin)])
async def admin_delete_user(
    user_id: int,
    session: SessionDep
):
    """Delete a user (Admin only)"""
    
    user_service.delete_user(session, user_id)

    return BaseResponse(
        code=status.HTTP_200_OK, 
        result=True, 
        message="Personnel record purged successfully"
    )