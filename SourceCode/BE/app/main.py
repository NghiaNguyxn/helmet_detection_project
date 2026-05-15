import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO

from SourceCode.BE.app.api import (
    alert_router,
    auth_router,
    helmet_router,
    report_router,
    user_router,
    violations_router,
)
from SourceCode.BE.app.core.config import setting
from SourceCode.BE.app.core.websocket_manager import manager
from SourceCode.BE.app.database.nosql_database import close_mongodb_connection, connect_to_mongodb
from SourceCode.BE.app.database.sql_database import init_sql_db
from SourceCode.BE.app.exceptions.handlers import register_exception_handlers

# Cấu hình Logging chuẩn: Thời gian xảy ra - Tên Module - Cấp độ lỗi - Nội dung chi tiết
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading model from %s...", setting.MODEL_PATH)

    try:
        app.state.model = YOLO(setting.MODEL_PATH, task="detect")
        app.state.model_loaded = True
        logger.info("Model loaded successfully")
    except Exception:
        app.state.model_loaded = False
        logger.exception("Model loading failed")
        raise

    init_sql_db()
    logger.info("SQL database initialized")

    await connect_to_mongodb(app)

    app.state.websocket_manager = manager
    logger.info("WebSocket manager initialized")

    yield

    await close_mongodb_connection(app)
    logger.info("Shutting down system...")


app = FastAPI(
    title="Helmet Detection System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=setting.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent.parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

# Đăng ký tất cả exception handlers
register_exception_handlers(app)


@app.get("/")
async def root():
    return {"message": "Helmet Detection System API"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": getattr(app.state, "model_loaded", False),
        "mongodb_connected": hasattr(app.state, "mongodb_client"),
        "database": setting.DATABASE_NAME,
        "cors_origins": setting.CORS_ORIGINS,
    }


app.include_router(helmet_router.router)
app.include_router(alert_router.router)
app.include_router(violations_router.router)
app.include_router(user_router.router)
app.include_router(auth_router.router)
app.include_router(report_router.router)
