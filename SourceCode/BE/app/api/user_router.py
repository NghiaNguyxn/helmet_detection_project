from fastapi import APIRouter, status, Depends, File, Request, UploadFile

from SourceCode.BE.app.schemas import auth_schema
from SourceCode.BE.app.services import audit_service
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
    session: SessionDep,
    request: Request
):
    """Update current authenticated user's details"""

    update_data = user_update.model_dump(exclude_unset=True)
    before_update = {
        field: getattr(current_user, field)
        for field in update_data.keys()
        if hasattr(current_user, field)
    }

    user = user_service.update_user(session, current_user.id, user_update)
    changes = {}
    for field, old_value in before_update.items():
        new_value = getattr(user, field)
        if old_value != new_value:
            changes[field] = {
                "old": old_value.value if hasattr(old_value, "value") else old_value,
                "new": new_value.value if hasattr(new_value, "value") else new_value,
            }

    audit_service.create_log(
        session=session,
        action="user.updated",
        actor=current_user,
        target_type="user",
        target_id=user.id,
        description=f"Updated profile for {user.username}",
        ip_address=audit_service.request_ip(request),
        metadata={
            "changed_fields": list(changes.keys()),
            "changes": changes,
        },
    )

    return BaseResponse(
        code=status.HTTP_200_OK,
        result=user,
        message="User updated successfully"
    )

@router.patch("/me/avatar", response_model=BaseResponse[user_schema.UserResponse])
async def update_user_avatar(
    current_user: ActiveUser,
    session: SessionDep,
    request: Request,
    file: UploadFile = File(...)
):
    """Update current authenticated user's avatar"""
    user = await user_service.update_avatar(session, current_user.id, file)
    audit_service.create_log(
        session=session,
        action="user.avatar_updated",
        actor=current_user,
        target_type="user",
        target_id=user.id,
        description=f"Updated avatar for {user.username}",
        ip_address=audit_service.request_ip(request),
        metadata={"avatar_url": user.avatar_url},
    )
    
    return BaseResponse(
        code=status.HTTP_200_OK,
        result=user,
        message="Avatar updated successfully"
    )

@router.post("/change-password")
async def change_password(
    request: auth_schema.ChangePasswordRequest,
    current_user: VerifiedUser,
    session: SessionDep,
    http_request: Request
):
    """Change current authenticated user's password"""

    user_service.change_password(session, current_user.id, request.current_password, request.new_password)
    audit_service.create_log(
        session=session,
        action="user.password_changed",
        actor=current_user,
        target_type="user",
        target_id=current_user.id,
        description=f"Changed password for {current_user.username}",
        ip_address=audit_service.request_ip(http_request),
    )

    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Password changed successfully"
    )

@router.patch("/{user_id}/status", response_model=BaseResponse[user_schema.UserResponse])
async def admin_update_user_status(
    user_id: int,
    is_active: bool,
    session: SessionDep,
    request: Request,
    admin_user = Depends(allow_admin),
):
    """Update user status (Admin only)"""
    
    target_user = user_service.get_user(session, user_id)
    old_status = target_user.is_active if target_user else None
    user = user_service.update_status(session, user_id, is_active)
    audit_service.create_log(
        session=session,
        action="user.status_changed",
        actor=admin_user,
        target_type="user",
        target_id=user.id,
        description=f"Changed status for user {user.username}",
        ip_address=audit_service.request_ip(request),
        metadata={"old_is_active": old_status, "new_is_active": user.is_active},
    )

    return BaseResponse(
        code=status.HTTP_200_OK, 
        result=user,
        message="User status updated successfully"
    )

@router.delete("/{user_id}", response_model=BaseResponse[bool])
async def admin_delete_user(
    user_id: int,
    session: SessionDep,
    request: Request,
    admin_user = Depends(allow_admin),
):
    """Delete a user (Admin only)"""
    
    target_user = user_service.get_user(session, user_id)
    target_snapshot = None
    if target_user:
        target_snapshot = {
            "id": target_user.id,
            "username": target_user.username,
            "email": target_user.email,
            "role": target_user.role.value,
        }
    user_service.delete_user(session, user_id)
    audit_service.create_log(
        session=session,
        action="user.deleted",
        actor=admin_user,
        target_type="user",
        target_id=user_id,
        description=f"Deleted user {target_snapshot['username'] if target_snapshot else user_id}",
        ip_address=audit_service.request_ip(request),
        metadata=target_snapshot,
    )

    return BaseResponse(
        code=status.HTTP_200_OK, 
        result=True, 
        message="Personnel record purged successfully"
    )
