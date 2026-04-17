import cv2
import asyncio
import time
from datetime import datetime
from ultralytics import YOLO
from motor.motor_asyncio import AsyncIOMotorCollection
from fastapi import BackgroundTasks, Request

from SourceCode.BE.app.core.config import setting
from SourceCode.BE.app.utils.drawing import annotated_helmet_frame
from SourceCode.BE.app.services.violation_services import save_violation_backtask

last_alert_time = 0
is_camera_running = False

def stop_video_frames():
    global is_camera_running
    is_camera_running = False

async def generated_video_frames(
        request: Request,
        model: YOLO,
        db_collection: AsyncIOMotorCollection,
        background_tasks: BackgroundTasks
    ):
    """Generator function to process video frames and yield annotated frames as bytes"""

    global last_alert_time, is_camera_running
    is_camera_running = True
    cap = cv2.VideoCapture(0)  # Mở webcam

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    try:
        while is_camera_running:
            if await request.is_disconnected():
                print("Client disconnect detected from request, releasing camera")
                is_camera_running = False
                break

            success, frame = cap.read()
            if not success:
                break
            
            # 1. Chạy AI
            results = await asyncio.to_thread(
                model.predict, 
                frame, 
                imgsz=416, 
                conf=setting.VIOLATION_THRESHOLD, 
                verbose=False
            )

            # 2. Vẽ bounding box và đếm số lượng vi phạm
            annotated_frame, all_detections, violation_count = annotated_helmet_frame(frame, results)

            # 3. Logic lưu Database (Chỉ lưu khi có vi phạm và hết Cooldown)
            current_time = time.time()

            if(violation_count > 0 and (current_time - last_alert_time > setting.ALERT_COOLDOWN)):
                last_alert_time = current_time

                # Chạy task lưu DB ngay lập tức bằng asyncio.create_task thay vì BackgroundTasks 
                # (BackgroundTasks chỉ chạy sau khi StreamingResponse kết thúc)
                asyncio.create_task(
                    save_violation_backtask(
                        annotated_frame, 
                        violation_count, 
                        all_detections, 
                        db_collection
                    )
                )
                print(f"[Live Monitoring] Detected {violation_count} violations. Scheduled immediate save.")

            # 4. 
            ret, buffer = cv2.imencode('.jpg', annotated_frame)
            yield (b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            
            await asyncio.sleep(0.01)  # Thêm delay nhỏ để giảm tải CPU
    except Exception as e:
        print(f"Generator stopped: {e}")
    finally:
        is_camera_running = False
        print("Releasing camera resources...")
        cap.release()