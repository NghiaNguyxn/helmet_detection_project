from pathlib import Path
from typing import Any

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):

    # Database
    SQLITE_URL: str
    MONGO_URL: str
    DATABASE_NAME: str
    VIOLATION_COLLECTION: str
    TRAFFIC_STATS_COLLECTION: str

    # AI & System 
    MODEL_PATH: str
    VIOLATION_THRESHOLD: float 
    ALERT_COOLDOWN: int
    INFERENCE_DEVICE: int | str = 0
    INFERENCE_HALF: bool = True
    IMAGE_INFERENCE_SIZE: int = 416
    VIDEO_INFERENCE_SIZE: int = 640
    RTSP_INFERENCE_SIZE: int = 416
    
    # Tracker
    TRACK_HIGH_THRESH: float = 0.5
    TRACK_LOW_THRESH: float = 0.1
    NEW_TRACK_THRESH: float = 0.6
    TRACK_BUFFER: int = 60
    MATCH_THRESH: float = 0.8

    # Directory
    VIOLATION_DIR: str

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str

    # Initial Admin Account
    FIRST_ADMIN_USERNAME: str
    FIRST_ADMIN_EMAIL: str
    FIRST_ADMIN_PASSWORD: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int

    # Email (mô phỏng)
    MAIL_SERVER: str | None = None
    MAIL_USERNAME: str | None = None
    MAIL_PASSWORD: str | None = None
    MAIL_PORT: int | None = None
    MAIL_FROM: str | None = None

    # Frontend URLs
    FRONTEND_URL: str | None = None
    FRONTEND_VERIFY_PATH: str | None = None
    FRONTEND_RESET_PASSWORD_PATH: str | None = None
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent.parent / ".env"),
        env_file_encoding='utf-8',
        extra='allow'
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> list[str]:
        if value is None or value == "":
            return ["http://localhost:5173"]
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("INFERENCE_DEVICE", mode="before")
    @classmethod
    def parse_inference_device(cls, value: Any) -> int | str:
        if isinstance(value, str) and value.isdigit():
            return int(value)
        return value

    @model_validator(mode="after")
    def validate_runtime_settings(self):
        weak_secret_values = {"changeme", "change-me", "your_secret_key", "secret", "dev-secret"}
        if self.SECRET_KEY in weak_secret_values or len(self.SECRET_KEY) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters and not use a placeholder value")

        # weak_admin_passwords = {"password", "admin", "admin123", "your-admin-pssword", "your-admin-password"}
        # if self.FIRST_ADMIN_PASSWORD in weak_admin_passwords or len(self.FIRST_ADMIN_PASSWORD) < 8:
        #     raise ValueError("FIRST_ADMIN_PASSWORD must be at least 8 characters and not use a placeholder value")

        if not Path(self.MODEL_PATH).exists():
            raise ValueError(f"MODEL_PATH does not exist: {self.MODEL_PATH}")

        if self.VIOLATION_THRESHOLD < 0 or self.VIOLATION_THRESHOLD > 1:
            raise ValueError("VIOLATION_THRESHOLD must be between 0 and 1")

        return self

setting = Settings()
