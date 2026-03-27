from fastapi import FastAPI
from contextlib import asynccontextmanager
from ultralytics import YOLO

from app.core.config import setting
from app.api import helmet_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Loading model...")

    app.state.model = YOLO(setting.MODEL_PATH)

    print("Model loaded successfully")

    yield

    print("Shutting down system...")


app = FastAPI(
    title="Helmet Detection System",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/")
async def root():
    return {"message": "Helmet Detection System API"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

app.include_router(helmet_router.router)