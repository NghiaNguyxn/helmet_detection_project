from fastapi import UploadFile, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from ultralytics import YOLO
import cv2
import numpy as np
import base64
import time

from app.schemas.helmet_schema import PredictResponse
from app.core.config import setting
from app.exceptions.helmet import ImageDecodingError
from app.services.violation_services import save_violation_backtask
from app.utils.drawing import annotated_helmet_frame

async def process_and_log_violation(file: UploadFile, model: YOLO, db_collection, background_tasks: BackgroundTasks) -> PredictResponse:

    try:
        # Đọc dữ liệu binary từ UploadFile theo chuẩn FastAPI
        contents = await file.read() 

        # Chuyển dữ liệu binary sang OpenCV Image (NumPy array)
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ImageDecodingError()
    except Exception as e:
        raise ImageDecodingError()

    # 1. Chạy AI
    results = await run_in_threadpool(
        model.predict, 
        img, 
        imgsz=416, 
        conf=setting.VIOLATION_THRESHOLD, 
        verbose=True
    )
    
    # 2. Vẽ bounding box và đếm số lượng vi phạm
    annotated_frame, all_detections, violation_count = annotated_helmet_frame(img, results)

    # 3. Logic lưu Database (Chỉ lưu khi có vi phạm và hết Cooldown)
    if(violation_count > 0):
        background_tasks.add_task(save_violation_backtask, annotated_frame, violation_count, all_detections, db_collection)
        
    # 4. Trả về tất cả detections (bao gồm cả người đội mũ và không đội mũ)
    _, buffer = cv2.imencode(".jpg", annotated_frame)
    img_base64 = base64.b64encode(buffer).decode("utf-8")

    return PredictResponse(
        detections=all_detections,
        total_detections=len(all_detections),
        image_base64=img_base64
    )