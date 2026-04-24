from typing import Annotated
from fastapi import APIRouter, BackgroundTasks, UploadFile, File, HTTPException, Depends, status, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from ultralytics import YOLO
from motor.motor_asyncio import AsyncIOMotorCollection

from SourceCode.BE.app.services.helmet_service import process_and_log_violation
from SourceCode.BE.app.schemas.helmet_schema import PredictResponse
from SourceCode.BE.app.schemas.base_schema import BaseResponse
from SourceCode.BE.app.dependencies.model import get_model
from SourceCode.BE.app.dependencies.nosql_database import get_violation_collection
from SourceCode.BE.app.dependencies.user import allow_any_staff, VerifiedUser
from SourceCode.BE.app.services.video_service import generated_video_frames, stop_video_frames
from SourceCode.BE.app.exceptions.helmet import InvalidFileTypeError, CannotStopCameraError
from SourceCode.BE.app.core.websocket_manager import manager

router = APIRouter(prefix="/helmet", tags=["Helmet Detection"])

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    user: VerifiedUser
):
    """
    WebSocket endpoint for real-time helmet detection:
    - Accepts WebSocket connection from authenticated clients
    - Adds new connection to the active connections list
    - Listens for incoming messages (kept alive for now)
    - Removes connection upon disconnection
    """

    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle incoming messages if needed
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

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
):
    """
    Endpoint for live video stream with helmet detection:

    - **model**: YOLOv8 model loaded in memory
    - **db_collection**: MongoDB collection for logging violations

    Returns a streaming response of annotated video frames from the webcam.
    Logs to MongoDB Atlas if any 'Without Helmet' class is detected, with a cooldown to prevent spamming.
    """
    
    return StreamingResponse(
        generated_video_frames(model, db_collection), 
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.post("/stop-video-feed", dependencies=[Depends(allow_any_staff)])
async def stop_video_feed():
    """
    Stop the live video stream.
    """

    try:
        stop_video_frames()
        return BaseResponse(
            code=200, 
            message="Camera stopped successfully", 
        )
    except Exception as e:
        raise CannotStopCameraError()