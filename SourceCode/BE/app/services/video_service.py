import cv2
import time
import logging
import asyncio
import threading
from typing import Optional
from fastapi.concurrency import run_in_threadpool
from SourceCode.BE.app.core.config import setting
from SourceCode.BE.app.utils.drawing import annotated_helmet_frame
from SourceCode.BE.app.services.violation_service import save_violation_backtask
from SourceCode.BE.app.core.websocket_manager import manager

logger = logging.getLogger(__name__)

class GlobalCamera:
    def __init__(self):
        self.cap = None
        self.is_running = False
        self.raw_frame = None  # Khung hình thô mới nhất từ camera
        self.latest_frame = None # Khung hình đã qua xử lý AI (bytes)
        self.inference_task: Optional[asyncio.Task] = None
        self.capture_thread: Optional[threading.Thread] = None
        self.viewers_count = 0
        self.lock = asyncio.Lock()
        self.results = None # Lưu kết quả AI mới nhất

    async def start(self, model, db_collection):
        async with self.lock:
            self.viewers_count += 1
            logger.info(f"Viewer joined. Total viewers: {self.viewers_count}")
            
            if not self.is_running:
                logger.info("Starting global camera with dual-stream architecture...")
                self.cap = cv2.VideoCapture(0)
                
                # Cấu hình độ phân giải camera (HD 720p)
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

                if not self.cap.isOpened():
                    logger.error("Could not open video device")
                    return

                self.is_running = True
                
                # Luồng 1: Chụp ảnh thô liên tục (Threading để đạt FPS tối đa của Cam)
                self.capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
                self.capture_thread.start()

                # Luồng 2: Chạy AI inference (Async Task)
                self.inference_task = asyncio.create_task(self._inference_loop(model, db_collection))

    def _capture_loop(self):
        """Luồng chuyên trách việc đọc frame từ camera nhanh nhất có thể"""
        while self.is_running and self.cap.isOpened():
            success, frame = self.cap.read()
            if success:
                self.raw_frame = frame
            else:
                time.sleep(0.01)

    async def _inference_loop(self, model, db_collection):
        """Luồng chuyên trách chạy AI và chuẩn bị frame để stream"""
        last_alert_time = 0
        frame_count = 0
        
        try:
            while self.is_running:
                if self.raw_frame is None:
                    await asyncio.sleep(0.01)
                    continue

                frame = self.raw_frame.copy()
                frame_count += 1

                # Chỉ chạy AI mỗi 2 khung hình để tiết kiệm tài nguyên
                if frame_count % 2 == 0 or self.results is None:
                    self.results = await run_in_threadpool(
                        model.predict, 
                        frame, 
                        imgsz=416, 
                        conf=setting.VIOLATION_THRESHOLD, 
                        verbose=False,
                        device=0,
                        half=True
                    )

                # Luôn vẽ kết quả lên frame hiện tại
                annotated_frame, latest_all_detections, latest_violation_count = annotated_helmet_frame(frame, self.results)
                
                # Encode để streaming
                ret, buffer = cv2.imencode('.jpg', annotated_frame)
                if ret:
                    self.latest_frame = buffer.tobytes()

                # Kiểm tra vi phạm để lưu DB
                if latest_violation_count > 0:
                    current_time = time.time()
                    if (current_time - last_alert_time > setting.ALERT_COOLDOWN):
                        last_alert_time = current_time
                        logger.info(f"Violation detected! Saving to DB and broadcasting...")
                        
                        # Truyền manager vào để sau khi lưu xong sẽ broadcast kèm ID
                        # Sử dụng asyncio.create_task trực tiếp để lưu ngay lập tức mà không đợi tắt stream
                        asyncio.create_task(
                            save_violation_backtask(
                                annotated_frame.copy(),
                                latest_violation_count,
                                latest_all_detections,
                                db_collection,
                                manager
                            )
                        )
                
                # Tốc độ của vòng lặp AI có thể linh hoạt, 
                # không làm ảnh hưởng đến tốc độ Đọc của Camera
                await asyncio.sleep(0.01)
                
        except asyncio.CancelledError:
            logger.info("Inference loop stopped")
        except Exception as e:
            logger.error(f"Error in inference loop: {e}")

    async def stop(self):
        async with self.lock:
            if self.viewers_count > 0:
                self.viewers_count -= 1
            
            if self.viewers_count == 0 and self.is_running:
                logger.info("Stopping camera services...")
                self.is_running = False
                if self.cap:
                    self.cap.release()
                self.cap = None
                self.raw_frame = None
                self.latest_frame = None

# Khởi tạo đối tượng duy nhất
global_camera = GlobalCamera()

async def generated_video_frames(model, db_collection):
    await global_camera.start(model, db_collection)
    
    try:
        while True:
            if global_camera.latest_frame:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + global_camera.latest_frame + b'\r\n')
            
            # Nhường luồng một chút để hệ thống không bị treo
            await asyncio.sleep(0.01)
    finally:
        await global_camera.stop()

def stop_video_frames():
    asyncio.create_task(global_camera.stop())