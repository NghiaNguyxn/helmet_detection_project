from pydantic_settings import BaseSettings

class Settings(BaseSettings):

    MODEL_PATH: str = "app/weights/best_s.pt"

setting = Settings()