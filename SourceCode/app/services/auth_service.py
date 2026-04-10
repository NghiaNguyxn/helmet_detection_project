from sqlmodel import Session, select
from datetime import datetime, timezone, timedelta

from app.models.user import UserDB
from app.core import security
from app.services.user_service import get_user, get_user_by_email, get_user_by_username_or_email
from app.exceptions import auth as auth_exceptions, user as user_exceptions

def authenticate_user(session: Session, username: str, password: str):
    """User authentication"""
    
    user: UserDB = get_user_by_username_or_email(session, username)
    if not user or not security.verify_password(password, user.hashed_password):
        raise auth_exceptions.IncorrectCredentialsError()
    
    if not user.is_active:
        raise user_exceptions.UserInactive()

    return user

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
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=24)

    session.add(user)
    session.commit()
    return user.reset_token
    
def reset_password(session: Session, token: str, new_password: str):
    """Reset password using token"""

    now = datetime.now(timezone.utc)
    statement = select(UserDB).where(
        UserDB.reset_token == token,
        UserDB.reset_token_expires > now
    )
    user = session.exec(statement).first()

    if not user:
        raise auth_exceptions.InvalidTokenError()
    
    if security.verify_password(new_password, user.hashed_password):
        raise auth_exceptions.PasswordSameAsOld()
    
    user.hashed_password = security.get_password_hash(new_password)
    user.reset_token = None
    user.reset_token_expires = None

    session.add(user)
    session.commit()
    session.refresh(user)
    return user