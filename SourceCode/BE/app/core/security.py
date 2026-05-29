import jwt
from datetime import datetime, timedelta
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash

from SourceCode.BE.app.core.config import setting
from SourceCode.BE.app.schemas import auth_schema
from SourceCode.BE.app.utils import time as time_utils

# PasswordHashing
password_hash = PasswordHash.recommended()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)

def get_password_hash(plain_password: str) -> str:
    return password_hash.hash(plain_password)

# JWT functions
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()

    if expires_delta:
        expire = time_utils.utc_now_aware() + expires_delta
    else:
        expire = time_utils.utc_now_aware() + timedelta(minutes=setting.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, setting.SECRET_KEY, algorithm=setting.ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> auth_schema.TokenData | None:
    try:
        payload = jwt.decode(token, setting.SECRET_KEY, algorithms=[setting.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return auth_schema.TokenData(username=username)
    except InvalidTokenError:
        return None
    
def create_refresh_token() -> str:
    import secrets
    return secrets.token_urlsafe(32)

def hash_refresh_token(token: str) -> str:
    import hashlib
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def refresh_token_expire_at() -> datetime:
    return time_utils.utc_after(days=setting.REFRESH_TOKEN_EXPIRE_DAYS)

def get_refresh_cookie_max_age() -> int:
    return setting.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60

# Hàm tạo token xác thực (dùng cho email verification và reset password)
def create_verification_token() -> str:
    import secrets
    return secrets.token_urlsafe(32)

def create_reset_token() -> str:
    import secrets
    return secrets.token_urlsafe(32)
