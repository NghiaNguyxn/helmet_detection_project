from typing import Annotated
import logging

logger = logging.getLogger(__name__)

from datetime import timedelta
from fastapi import APIRouter, Depends, Request, Response, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm

from SourceCode.BE.app.dependencies.sql_database import SessionDep
from SourceCode.BE.app.dependencies.user import CurrentUser, allow_admin
from SourceCode.BE.app.services import auth_service, audit_service, user_service
from SourceCode.BE.app.schemas import auth_schema, user_schema
from SourceCode.BE.app.schemas.base_schema import BaseResponse
from SourceCode.BE.app.core import security
from SourceCode.BE.app.core.config import setting
from SourceCode.BE.app.exceptions import auth as auth_exceptions, user as user_exceptions
from SourceCode.BE.app.utils import email as email_utils

router = APIRouter(prefix="/auth", tags=["Authentication"])

REFRESH_TOKEN_COOKIE_NAME = "refresh_token"

def set_refresh_token_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        # secure=True,  # Chỉ gửi cookie qua HTTPS
        secure=False,  # Bỏ secure để phát triển trên localhost, bật lại khi deploy
        samesite="strict",  # Ngăn chặn CSRF
        max_age=security.get_refresh_cookie_max_age(),
        path="/auth"
    )

def clear_refresh_token_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        path="/auth"
    )

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
    session: SessionDep,
    request: Request,
    response: Response
):
    """Authenticate user and return access token"""

    user = auth_service.authenticate_user(session, form_data.username, form_data.password)
    
    access_token_expires = timedelta(minutes=setting.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )

    refresh_token = auth_service.create_refresh_token_record(session, user.id, request)

    set_refresh_token_cookie(response, refresh_token)

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

@router.post("/refresh", response_model=auth_schema.Token)
def refresh(
    request: Request, 
    response: Response,
    session: SessionDep
):
    """Refresh access token using the refresh token from cookie"""

    old_refresh_token: str = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    if not old_refresh_token:
        raise auth_exceptions.MissingRefreshTokenError()
    
    old_refresh_token_record = auth_service.get_valid_refresh_token(session, old_refresh_token)
    user = user_service.get_active_user_by_id(session, old_refresh_token_record.user_id)
    if not user:
        raise user_exceptions.UserInactive()

    new_access_token_expires = timedelta(minutes=setting.ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = security.create_access_token(
        data={"sub": user.username},
        expires_delta=new_access_token_expires
    )

    new_refresh_token = auth_service.rotate_refresh_token(session, old_refresh_token_record, request)
    set_refresh_token_cookie(response, new_refresh_token)

    return auth_schema.Token(
        access_token=new_access_token,
        token_type="bearer"
    )

@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    session: SessionDep,
):
    """Logout user by revoking the refresh token and clearing the cookie"""

    refresh_token: str = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    if refresh_token is not None:
        auth_service.revoke_refresh_token(session, refresh_token)

    clear_refresh_token_cookie(response)

    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Logout successfully"
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
    reset_request: auth_schema.ResetPasswordRequest,
    request: Request,
    response: Response,
    session: SessionDep
):
    """Reset password using the reset token and return access token"""

    user = auth_service.reset_password(session, reset_request.token, reset_request.new_password)
    
    access_token_expires = timedelta(minutes=setting.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )

    refresh_token = auth_service.create_refresh_token_record(session, user.id, request)
    set_refresh_token_cookie(response, refresh_token)

    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Password reset successfully. You are now logged in",
        result=auth_schema.Token(
            access_token=access_token, 
            token_type="bearer"
        )
    )
