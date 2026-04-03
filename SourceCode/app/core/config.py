from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):

    # Database
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

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent.parent / ".env"),
        env_file_encoding='utf-8'
    )


setting = Settings()