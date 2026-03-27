from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from ultralytics import YOLO

from app.services.helmet_service import detect_image
from app.schemas.helmet_schema import PredictResponse
from app.dependencies.model import get_model

router = APIRouter(prefix="/helmet", tags=["Helmet Detection"])

@router.post("/predict", response_model=PredictResponse)
async def predict_image(
    file: UploadFile = File(...),
    model: YOLO = Depends(get_model)
):
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    result = await detect_image(file, model)
    return result