from pydantic import field_validator
from sqlmodel import SQLModel, Field

class Token(SQLModel):
    access_token: str
    token_type: str

class TokenData(SQLModel):
    username: str | None = None

class ChangePasswordRequest(SQLModel):
    current_password: str
    new_password: str = Field(min_length=8)
    confirm_password: str

    @field_validator("confirm_password")
    def passwords_match(cls, v, info):
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Password do not match")
        return v

class ResetPasswordRequest(SQLModel):
    token: str
    new_password: str = Field(min_length=8)
    confirm_password: str

    @field_validator("confirm_password")
    def passwords_match(cls, v, info):
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Password do not match")
        return v