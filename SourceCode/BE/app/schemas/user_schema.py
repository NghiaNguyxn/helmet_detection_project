from datetime import datetime
from pydantic import EmailStr, field_validator
from sqlmodel import SQLModel, Field

from SourceCode.BE.app.enums.user_role import UserRole
from SourceCode.BE.app.models.user import UserBase

class UserCreate(UserBase):
    password: str = Field(min_length=8)
    password_confirm: str

    @field_validator("password_confirm")
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Password do not match")
        return v
    
class UserResponse(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    created_at: datetime

class UserUpdate(SQLModel): # Không kế thừa Base vì các trường này đều là Optional
    username: str | None = None
    email: EmailStr | None = None
    full_name: str | None = None
    avatar_url: str | None = None
    is_active: bool | None = None

class ReviewUser(SQLModel):
    id: int
    username: str
    role: UserRole