from typing import Annotated
import logging

logger = logging.getLogger(__name__)

from datetime import timedelta
from fastapi import APIRouter, Depends, Request, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm

from SourceCode.BE.app.dependencies.sql_database import SessionDep
from SourceCode.BE.app.dependencies.user import CurrentUser, allow_admin, allow_any_staff
from SourceCode.BE.app.schemas import auth_schema
from SourceCode.BE.app.services import auth_service
from SourceCode.BE.app.services import audit_service
from SourceCode.BE.app.services import user_service
from SourceCode.BE.app.schemas import user_schema
from SourceCode.BE.app.schemas.base_schema import BaseResponse
from SourceCode.BE.app.core import security
from SourceCode.BE.app.core.config import setting
from SourceCode.BE.app.utils import email as email_utils

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", 
            response_model=BaseResponse[user_schema.UserResponse],
            status_code=status.HTTP_201_CREATED)
async def register(
    user_create: user_schema.UserCreate,
    session: SessionDep,
    bg_tasks: BackgroundTasks,
    request: Request,
    admin_user = Depends(allow_admin),
):
    """Register a new user and send verification email"""

    user = user_service.create_user(session, user_create)
    
    bg_tasks.add_task(
        email_utils.send_verification_email, 
        user=user, 
        token=user.verification_token
    )
    audit_service.create_log(
        session=session,
        action="user.created",
        actor=admin_user,
        target_type="user",
        target_id=user.id,
        description=f"Created user {user.username}",
        ip_address=audit_service.request_ip(request),
        metadata={
            "username": user.username,
            "email": user.email,
            "role": user.role.value,
            "is_active": user.is_active,
            "is_verified": user.is_verified,
        },
    )
    
    return BaseResponse(
        code=status.HTTP_201_CREATED,
        message="Register successfully",
        result=user
    )

@router.post("/login", response_model=auth_schema.Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep
):
    """Authenticate user and return access token"""

    user = auth_service.authenticate_user(session, form_data.username, form_data.password)
    
    access_token_expires = timedelta(minutes=setting.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )

    # return BaseResponse(
    #     code=status.HTTP_200_OK,
    #     message="Login successfully",
    #     result=auth_schema.Token(
    #         access_token=access_token, 
    #         token_type="bearer"
    #     )
    # )

    return auth_schema.Token(
            access_token=access_token, 
            token_type="bearer"
        )

@router.get("/verify-email", response_model=BaseResponse[auth_schema.Token])
async def verify_email(
    token: str,
    session: SessionDep
):
    """Verify user's email using the token and return access token"""

    user = auth_service.verify_email_token(session, token)
    
    access_token_expires = timedelta(minutes=setting.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )

    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Email verified and logged in successfully",
        result=auth_schema.Token(
            access_token=access_token, 
            token_type="bearer"
        )
    )

@router.post("/resend-verification")
async def resend_verification(
    current_user: CurrentUser,
    session: SessionDep,
    bg_tasks: BackgroundTasks
):
    """Resend email verification token to the user"""

    new_token = auth_service.regenerate_verification_token(session, current_user)
    
    bg_tasks.add_task(
        email_utils.send_verification_email, 
        user=current_user, 
        token=new_token
    )

    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Verification email resent successfully"
    )

@router.post("/forgot-password")
async def forgot_password(
    user_mail: str,
    session: SessionDep,
    bg_task: BackgroundTasks
):
    """Initiate forgot password process by sending reset email"""

    try:
        reset_token = auth_service.create_password_reset_token(session, user_mail)
        user = user_service.get_user_by_email(session, user_mail)
        
        bg_task.add_task(
            email_utils.send_password_reset_email, 
            user=user, 
            token=reset_token
        )
    except Exception as e:
        logger.error(f"Error sending password reset email: {e}")

    return BaseResponse(
        code=status.HTTP_200_OK,
        message="If your email is registered, you will receive a password reset link"
    )

@router.post("/reset-password", response_model=BaseResponse[auth_schema.Token])
async def reset_password(
    request: auth_schema.ResetPasswordRequest,
    session: SessionDep
):
    """Reset password using the reset token and return access token"""

    user = auth_service.reset_password(session, request.token, request.new_password)
    
    access_token_expires = timedelta(minutes=setting.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )

    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Password reset successfully. You are now logged in",
        result=auth_schema.Token(
            access_token=access_token, 
            token_type="bearer"
        )
    )
