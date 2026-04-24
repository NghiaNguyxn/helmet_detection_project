from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from contextlib import asynccontextmanager
from ultralytics import YOLO

from SourceCode.BE.app.api import auth_router, helmet_router, report_router, user_router
from SourceCode.BE.app.core.config import setting
from SourceCode.BE.app.exceptions.handlers import register_exception_handlers
from SourceCode.BE.app.api import violations_router
from SourceCode.BE.app.database.sql_database import init_sql_db
from SourceCode.BE.app.database.nosql_database import connect_to_mongodb, close_mongodb_connection
from SourceCode.BE.app.core.websocket_manager import manager

import logging

# Cấu hình Logging chuẩn: Thời gian xảy ra - Tên Module - Cấp độ lỗi - Nội dung chi tiết
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),  # Log ra Console
    ]
)

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading model...")

    app.state.model = YOLO(setting.MODEL_PATH)
    # Ép sử dụng GPU nếu có thể
    app.state.model.to('cuda') 
    logger.info("Model loaded successfully on GPU (CUDA)")

    init_sql_db()
    logger.info("SQL database initialized")

    await connect_to_mongodb(app)

    app.state.websocket_manager = manager
    logger.info("WebSocket Manager initialized")

    yield

    await close_mongodb_connection(app)

    logger.info("Shutting down system...")


app = FastAPI(
    title="Helmet Detection System",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tính toán đường dẫn tới thư mục static bằng pathlib
# __file__ ở đây là: app/main.py
BASE_DIR = Path(__file__).parent.parent

static_path = BASE_DIR / "static"

# Mount thư mục static để FastAPI có thể phục vụ file tĩnh
app.mount("/static", StaticFiles(directory=static_path), name="static")

# Đăng ký tất cả exception handlers
register_exception_handlers(app)

@app.get("/")
async def root():
    return {"message": "Helmet Detection System API"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

app.include_router(helmet_router.router)
app.include_router(violations_router.router)
app.include_router(user_router.router)
app.include_router(auth_router.router)
app.include_router(report_router.router)