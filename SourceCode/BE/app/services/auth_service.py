from fastapi import Request
from sqlmodel import Session, select, update

from SourceCode.BE.app.exceptions import auth as auth_exceptions
from SourceCode.BE.app.models.refresh_token import RefreshToken
from SourceCode.BE.app.models.user import UserDB
from SourceCode.BE.app.core import security
from SourceCode.BE.app.utils import time as time_utils
from SourceCode.BE.app.services.user_service import get_user, get_user_by_email, get_user_by_username_or_email
from SourceCode.BE.app.exceptions import user as user_exceptions

def get_client_ip(request: Request) -> str:
    """Get client IP address from request"""

    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0].strip()
    else:
        ip = request.client.host
    return ip

def authenticate_user(session: Session, username: str, password: str):
    """User authentication"""
    
    user: UserDB = get_user_by_username_or_email(session, username)
    if not user or not security.verify_password(password, user.hashed_password):
        raise auth_exceptions.IncorrectCredentialsError()
    
    if not user.is_active:
        raise user_exceptions.UserInactive()

    return user

def create_refresh_token_record(
    session: Session,
    user_id: int,
    request: Request
):
    """Create a refresh token record in the database"""

    refresh_token = security.create_refresh_token()
    refresh_token_hash = security.hash_refresh_token(refresh_token)
    expires_at = security.refresh_token_expire_at()
    ip_address = get_client_ip(request)
    user_agent = request.headers.get("User-Agent")

    refresh_token_record = RefreshToken(
        user_id=user_id,
        token_hash=refresh_token_hash,
        expires_at=expires_at,
        ip_address=ip_address,
        user_agent=user_agent
    )

    session.add(refresh_token_record)
    session.commit()
    session.refresh(refresh_token_record)

    return refresh_token

def get_valid_refresh_token(session: Session, refresh_token: str) -> RefreshToken | None:
    """Get a valid refresh token record from the database"""

    token_hash = security.hash_refresh_token(refresh_token)

    statement = select(RefreshToken).where(
        RefreshToken.token_hash == token_hash
    )

    token_record = session.exec(statement).first()
    if not token_record:
        raise auth_exceptions.InvalidRefreshTokenError()
    
    if time_utils.as_utc_aware(token_record.expires_at) < time_utils.utc_now():
        raise auth_exceptions.ExpiredRefreshTokenError()
    
    if token_record.revoked_at is not None:
        raise auth_exceptions.RevokedRefreshTokenError()

    return token_record

def rotate_refresh_token(
    session: Session,
    token_record: RefreshToken,
    request: Request
) -> str:
    """Rotate refresh token: revoke the old one and create a new one"""

    new_refresh_token = security.create_refresh_token()
    new_token_hash = security.hash_refresh_token(new_refresh_token)
    expires_at = security.refresh_token_expire_at()
    user_agent = request.headers.get("User-Agent")
    ip_address = get_client_ip(request)

    revoked_statement = (
        update(RefreshToken)
        .where(
            RefreshToken.id == token_record.id,
            RefreshToken.revoked_at == None,
            RefreshToken.expires_at > time_utils.utc_now()
        )
        .values(
            revoked_at=time_utils.utc_now(),
            replaced_by=new_token_hash
        )
    )

    result = session.exec(revoked_statement)
    if result.rowcount != 1:
        session.rollback()
        raise auth_exceptions.RevokedRefreshTokenError()

    new_token_record = RefreshToken(
        user_id=token_record.user_id,
        token_hash=new_token_hash,
        expires_at=expires_at,
        user_agent=user_agent,
        ip_address=ip_address,
        last_used_at=time_utils.utc_now()
    )

    session.add(new_token_record)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise 
    
    session.refresh(new_token_record)
    return new_refresh_token


def revoke_refresh_token(session: Session, refresh_token: str) -> None:
    """Revoke a refresh token"""

    token_hash = security.hash_refresh_token(refresh_token)

    statement = select(RefreshToken).where(
        RefreshToken.token_hash == token_hash
    )

    token_record = session.exec(statement).first()
    if token_record is None:
        return
    
    if token_record.revoked_at is None:
        token_record.revoked_at = time_utils.utc_now()
        session.add(token_record)
        session.commit()

def revoke_user_refresh_tokens(session: Session, user_id: int) -> None:
    """Revoke all refresh tokens for a user"""

    statement = select(RefreshToken).where(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at == None
    )

    token_records = session.exec(statement).all()
    for token_record in token_records:
        token_record.revoked_at = time_utils.utc_now()
        session.add(token_record)
    
    session.commit()

def verify_email_token(session: Session, token: str):
    """Verify email using a token"""

    statement = select(UserDB).where(UserDB.verification_token == token)
    user = session.exec(statement).first()

    if not user:
        raise user_exceptions.UserNotFound()
    
    if user.is_verified:
        raise user_exceptions.UserAlreadyVerified()

    user.is_verified = True
    user.verification_token = None
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

def regenerate_verification_token(session: Session, user: UserDB):
    """Regenerate verification token"""

    if user.is_verified:
        raise user_exceptions.UserAlreadyVerified()
    
    user.verification_token = security.create_verification_token()
    session.add(user)
    session.commit()
    session.refresh(user)
    return user.verification_token

def create_password_reset_token(session: Session, email: str):
    """Create a password reset token"""

    user: UserDB = get_user_by_email(session, email)
    if not user:
        raise user_exceptions.UserNotFound()
    
    user.reset_token = security.create_reset_token()
    user.reset_token_expires = time_utils.utc_after(hours=24)

    session.add(user)
    session.commit()
    return user.reset_token
    
def reset_password(session: Session, token: str, new_password: str):
    """Reset password using token"""

    now = time_utils.utc_now()
    statement = select(UserDB).where(
        UserDB.reset_token == token,
        UserDB.reset_token_expires > now
    )
    user = session.exec(statement).first()

    if not user:
        raise auth_exceptions.InvalidResetTokenError()
    
    if security.verify_password(new_password, user.hashed_password):
        raise auth_exceptions.PasswordSameAsOld()
    
    revoke_user_refresh_tokens(session, user.id)
    
    user.hashed_password = security.get_password_hash(new_password)
    user.reset_token = None
    user.reset_token_expires = None

    session.add(user)
    session.commit()
    session.refresh(user)
    return user
