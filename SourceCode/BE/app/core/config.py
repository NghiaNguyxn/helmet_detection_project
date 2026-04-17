from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):

    # Database
    SQLITE_URL: str
    MONGO_URL: str
    DATABASE_NAME: str
    VIOLATION_COLLECTION: str

    # AI & System 
    MODEL_PATH: str
    VIOLATION_THRESHOLD: float 
    ALERT_COOLDOWN: int

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

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent.parent / ".env"),
        env_file_encoding='utf-8',
        extra='ignore'
    )


setting = Settings()