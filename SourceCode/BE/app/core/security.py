import jwt
from datetime import datetime, timedelta, timezone
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash

from SourceCode.BE.app.core.config import setting
from SourceCode.BE.app.schemas import auth_schema

# PasswordHashing
password_hash = PasswordHash.recommended()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)

def get_password_hash(plain_password: str) -> str:
    return password_hash.hash(plain_password)

# JWT functions
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=setting.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, setting.SECRET_KEY, algorithm=setting.ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    try:
        payload = jwt.decode(token, setting.SECRET_KEY, algorithms=[setting.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return auth_schema.TokenData(username=username)
    except InvalidTokenError:
        return None
    
# Hàm tạo token xác thực (dùng cho email verification và reset password)
def create_verification_token() -> str:
    import secrets
    return secrets.token_urlsafe(32)

def create_reset_token() -> str:
    import secrets
    return secrets.token_urlsafe(32)
