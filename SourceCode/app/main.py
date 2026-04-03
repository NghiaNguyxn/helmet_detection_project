from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from contextlib import asynccontextmanager
from ultralytics import YOLO

from app.core.config import setting
from app.exceptions.handlers import register_exception_handlers
from app.api import helmet_router, violations_router

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

# Tính toán đường dẫn tới thư mục static bằng pathlib
# __file__ ở đây là: app/main.py
BASE_DIR = Path(__file__).parent.parent

static_path = BASE_DIR / "static"
violation_path = BASE_DIR / setting.VIOLATION_DIR

# Tự động tạo thư mục violations nếu chưa tồn tại
violation_path.mkdir(parents=True, exist_ok=True)

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