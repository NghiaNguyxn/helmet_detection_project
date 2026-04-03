import cv2
import asyncio
import time
from datetime import datetime
from ultralytics import YOLO
from motor.motor_asyncio import AsyncIOMotorCollection
from fastapi import BackgroundTasks

from app.core.config import setting
from app.utils.drawing import annotated_helmet_frame
from app.services.violation_services import save_violation_backtask

last_alert_time = 0

async def gennerated_video_frames(
        model: YOLO,
        db_collection: AsyncIOMotorCollection,
        background_tasks: BackgroundTasks
    ):
    """Generator function to process video frames and yield annotated frames as bytes"""

    global last_alert_time
    cap = cv2.VideoCapture(0)  # Mở webcam

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    while True:
        success, frame = cap.read()
        if not success:
            break
        
        # 1. Chạy AI
        results = await asyncio.to_thread(
            model.predict, 
            frame, 
            imgsz=416, 
            conf=setting.VIOLATION_THRESHOLD, 
            verbose=True
            # verbose=False
        )

        # 2. Vẽ bounding box và đếm số lượng vi phạm
        annotated_frame, all_detections, violation_count = annotated_helmet_frame(frame, results)

        # 3. Logic lưu Database (Chỉ lưu khi có vi phạm và hết Cooldown)
        current_time = time.time()

        if(violation_count > 0 and (current_time - last_alert_time > setting.ALERT_COOLDOWN)):
            last_alert_time = current_time

            background_tasks.add_task(
                save_violation_backtask, 
                annotated_frame, 
                violation_count, 
                all_detections, 
                db_collection
            )
            print(f"[Live Monitoring] Detected {violation_count} violations. Added background task to save history.")

        # 4. 
        ret, buffer = cv2.imencode('.jpg', annotated_frame)
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        
        await asyncio.sleep(0.04)  # Thêm delay nhỏ để giảm tải CPU

    cap.release()