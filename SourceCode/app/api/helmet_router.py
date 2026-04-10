from fastapi import APIRouter, BackgroundTasks, UploadFile, File, HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from ultralytics import YOLO
from motor.motor_asyncio import AsyncIOMotorCollection

from app.services.helmet_service import process_and_log_violation
from app.schemas.helmet_schema import PredictResponse
from app.schemas.base_schema import BaseResponse
from app.dependencies.model import get_model
from app.dependencies.nosql_database import get_violation_collection
from app.dependencies.user import allow_admin, allow_any_staff
from app.services.video_service import generated_video_frames
from app.exceptions.helmet import InvalidFileTypeError

router = APIRouter(prefix="/helmet", tags=["Helmet Detection"])

@router.post("/predict", response_model=BaseResponse[PredictResponse])
async def predict_image(
    file: UploadFile = File(...),
    model: YOLO = Depends(get_model),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Predict helmet usage from an uploaded image:
    
    - **file**: The image file (jpg, png, etc.)
    - **model**: YOLOv8 model loaded in memory
    - **db_collection**: MongoDB collection for logging violations
    
    Returns detection details, total count, and a base64-encoded annotated image.
    Logs to MongoDB Atlas if any 'Without Helmet' class is detected.
    """

    # Validate file type
    if not file.content_type.startswith("image/"):
        raise InvalidFileTypeError()
    
    result = await process_and_log_violation(file, model, db_collection, background_tasks)
    
    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Predict successfully",
        result=result
    )

@router.get("/video-feed", dependencies=[Depends(allow_any_staff)])
async def video_feed(
    model: YOLO = Depends(get_model),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Endpoint for live video stream with helmet detection:

    - **model**: YOLOv8 model loaded in memory
    - **db_collection**: MongoDB collection for logging violations

    Returns a streaming response of annotated video frames from the webcam.
    Logs to MongoDB Atlas if any 'Without Helmet' class is detected, with a cooldown to prevent spamming.
    """
    
    return StreamingResponse(
        generated_video_frames(model, db_collection, background_tasks), 
        media_type="multipart/x-mixed-replace; boundary=frame"
    )