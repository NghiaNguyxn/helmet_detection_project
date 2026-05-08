import cv2
import time
import logging
import asyncio
from datetime import datetime
import threading
import yaml
import os
import numpy as np
from pathlib import Path
from typing import Optional
from collections import deque
from dotenv import dotenv_values
from fastapi.concurrency import run_in_threadpool
from SourceCode.BE.app.core.config import setting
from SourceCode.BE.app.utils.drawing import annotated_helmet_frame
from SourceCode.BE.app.services.violation_service import save_violation_backtask
from SourceCode.BE.app.core.websocket_manager import manager
from SourceCode.BE.app.services import alert_service
from SourceCode.BE.app.schemas.alert_schema import SecurityAlertCreate

logger = logging.getLogger(__name__)

# Tối ưu hóa cho RTSP: Giảm độ trễ bằng cách ép OpenCV dùng FFMPEG với tham số luồng thấp
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;udp"

class GlobalCamera:
    def __init__(self):
        """Initialize the GlobalCamera singleton with default states"""

        self.cap = None
        self.is_running = False
        self.raw_frame = None   # Khung hình thô mới nhất từ camera
        self.latest_frame = None  # Khung hình đã qua xử lý AI (bytes)
        self.inference_task: Optional[asyncio.Task] = None
        self.capture_thread: Optional[threading.Thread] = None
        self.lock = asyncio.Lock()
        self.cap_lock = threading.Lock()  # Khóa bảo vệ VideoCapture khỏi xung đột luồng

        # ── MULTI-VIEWER TRACKING (Sử dụng Set để tránh đếm trùng) ──────────
        # Lưu trữ danh sách viewer_id (v_id) đang hoạt động.
        # Pipeline chỉ dừng khi không còn ID nào trong danh sách.
        self.active_viewers: set[str] = set()

        # ── SESSION GUARD ─────────────────────────────────────────────────
        # session_id tăng mỗi lần pipeline khởi động MỚI (từ trạng thái dừng).
        # Mỗi generator nhận session_id tại thời điểm nó join.
        # stop(session_id) bị bỏ qua nếu session_id < session hiện tại.
        # → Chặn race condition bật-tắt nhanh: stop() của generator cũ
        #   không thể tắt nhầm pipeline mà generator mới vừa khởi động.
        self._session_id: int = 0

        # ── THREAD STOP SIGNAL ────────────────────────────────────────────
        # threading.Event để ra hiệu dừng _capture_loop NGAY LẬP TỨC
        # thay thế vòng for+sleep có thể block tới 5s → thoát < 10ms
        self._stop_event = threading.Event()
        
        # asyncio.Event để điều phối async flow
        self._session_cancel_event = None
        self._hw_released_event = None

        # Quản lý nguồn Camera & Thông tin vận hành
        self.camera_sources: dict[str, dict] = self._load_camera_sources()
        self.current_source_id = "CAM_1"  # Mặc định là CAM_1
        self.is_connected = False
        self.camera_status = "Inactive"  # Inactive, Connecting, Streaming, Error

        # Thông số FPS và Telemetry
        self.ai_fps = 0
        self.ai_frame_count = 0
        self.ai_fps_start_time = time.time()
        
        self.capture_fps = 0
        self.capture_frame_count = 0
        self.capture_fps_start_time = time.time()

        # Màn hình chờ (Placeholder) khi đang chuyển cam
        self.placeholder_frame = self._create_placeholder_frame("INITIALIZING...")

        # LOGIC THEO DÕI LỊCH SỬ THEO ID ĐỂ CHỐNG NHẢY (Flickering)
        self.track_history: dict[int, deque] = {} # {id: deque([class_id, class_id, ...], maxlen=10)}
        self.logged_ids = set()

        # Đường dẫn file config tracker
        self.tracker_config_path = Path(__file__).parent.parent / "core" / "custom_tracker.yaml"

    async def force_stop(self, user, session):
        """Forcefully clear all viewers and stop hardware, then broadcast alert"""
        self.active_viewers.clear()
        await self.stop("FORCE_STOP_SIGNAL")
        
        if self._session_cancel_event:
            self._session_cancel_event.set()
            
        # Phát cảnh báo hệ thống
        await alert_service.create_and_broadcast_alert(
            session, 
            user, 
            SecurityAlertCreate(
                message="SYSTEM FORCE RESET: All camera sessions have been terminated",
                camera_id="SYSTEM"
            )
        )
        logger.info(f"FORCE STOP executed by {user.username}")

    # ──────────────────────────────────────────────────────────────────────
    # CORE PIPELINE
    # ──────────────────────────────────────────────────────────────────────

    def _load_camera_sources(self) -> dict[str, dict]:
        """Load all CAM_X sources from .env with support for Friendly Names (Format: URL;Name)"""

        sources = {}
        env_path = Path(__file__).resolve().parent.parent.parent / ".env"

        try:
            # Đọc trực tiếp file .env để lấy tất cả các biến CAM_
            config = dotenv_values(env_path)
            # logger.info(f"--- DEBUG: Reading .env from {env_path} ---")
            for key, value in config.items():
                if key.upper().startswith("CAM_"):
                    # logger.info(f"Found in .env: {key} = {value}")
                    if value:
                        # Hỗ trợ định dạng: URL;Tên (Ví dụ: 0;Webcam Office)
                        parts = str(value).split(";", 1)
                        url = parts[0]
                        name = parts[1] if len(parts) > 1 else key.upper()
                        
                        sources[key.upper()] = {
                            "url": url,
                            "name": name
                        }
            # logger.info(f"--- DEBUG: Final Sources Dictionary: {sources} ---")
        except Exception as e:
            logger.error(f"Error reading .env file: {e}")

        # Nếu không tìm thấy gì, mặc định dùng webcam 0
        if not sources:
            sources["CAM_1"] = {"url": "0", "name": "Default Webcam"}

        logger.info(f"Loaded camera sources: {sources}")
        return sources

    def _create_placeholder_frame(self, text: str) -> bytes:
        """Create a black frame with a text message for MJPEG continuity"""

        # Tạo ảnh đen 1280x720
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)

        # Vẽ chữ ở giữa
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 1.5
        color = (255, 255, 255) # Trắng
        thickness = 3
        
        text_size = cv2.getTextSize(text, font, font_scale, thickness)[0]
        text_x = (frame.shape[1] - text_size[0]) // 2
        text_y = (frame.shape[0] + text_size[1]) // 2
        
        cv2.putText(frame, text, (text_x, text_y), font, font_scale, color, thickness)

        # Encode sang JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        return buffer.tobytes()

    def _update_tracker_config(self):
        """Create or update tracker YAML config from .env settings"""

        config = {
            "tracker_type": "bytetrack",
            "track_high_thresh": setting.TRACK_HIGH_THRESH,
            "track_low_thresh": setting.TRACK_LOW_THRESH,
            "new_track_thresh": setting.NEW_TRACK_THRESH,
            "track_buffer": setting.TRACK_BUFFER,
            "match_thresh": setting.MATCH_THRESH,
            "fuse_score": True # Ép buộc True để tránh lỗi thư viện
        }
        
        with open(self.tracker_config_path, 'w') as f:
            yaml.dump(config, f)
        logger.info(f"Tracker config updated: buffer={setting.TRACK_BUFFER}")

    # ──────────────────────────────────────────────────────────────────────
    # LIFECYCLE: start / stop
    # ──────────────────────────────────────────────────────────────────────

    async def start(self, model, db_collection, viewer_id: str, source_id: str = None) -> int:
        """
        Registers viewer_id and starts the pipeline if not already running.
        Returns the session_id for the caller to use during stop().

        Multi-viewer: if pipeline is already running, just register viewer_id and return.
        Session guard: each NEW hardware start increments session_id,
        invalidating any stop() signals from previous sessions.
        """

        async with self.lock:
            # Khởi tạo lazy cho asyncio.Event vì chúng cần event loop
            if self._session_cancel_event is None:
                self._session_cancel_event = asyncio.Event()
            if self._hw_released_event is None:
                self._hw_released_event = asyncio.Event()
                self._hw_released_event.set()  # Ban đầu phần cứng rảnh

            # CHỈ cập nhật source_id nếu nó được truyền vào cụ thể (không dùng mặc định CAM_1)
            if source_id and source_id in self.camera_sources:
                self.current_source_id = source_id

            # ── MULTI-VIEWER: Đăng ký ID người xem ──
            self.active_viewers.add(viewer_id)
            logger.info(
                f"Viewer joined (v_id={viewer_id}, "
                f"total={len(self.active_viewers)}, "
                f"session={self._session_id}, source={self.current_source_id})"
            )

            # Pipeline đang chạy → reuse, không khởi động lại
            if self.is_running:
                return self._session_id

            try:
                # ── Pipeline chưa chạy → khởi động phiên MỚI ──

                # Nếu phần cứng chưa nhả (background cleanup vẫn đang release camera)
                # → Phải đợi xong mới được mở VideoCapture mới, tránh xung đột driver
                if not self._hw_released_event.is_set():
                    logger.warning("Hardware is busy releasing from previous session. Waiting...")
                    await self._hw_released_event.wait()
                    logger.info("Hardware is now FREE. Proceeding to start new session.")

                # Tăng session_id → vô hiệu hoá mọi stop() của phiên cũ
                self._session_id += 1
                my_session = self._session_id
                logger.info(f"Starting new session={my_session} (source={self.current_source_id})")

                # Reset trạng thái
                self.camera_status = "Connecting"
                self.placeholder_frame = self._create_placeholder_frame(
                    f"CONNECTING TO {self.current_source_id}..."
                )
                self.latest_frame = None
                self.raw_frame = None
                self.track_history.clear() # Xóa lịch sử cũ
                self.logged_ids.clear()
                self._update_tracker_config()

                # Reset stop event và cancel signal cho phiên mới
                # QUAN TRỌNG: Phải clear trước khi set is_running = True
                # để generator mới không bị thoát ngay bởi signal cũ
                self._session_cancel_event.clear()
                self._stop_event.clear()
                self.is_running = True

                # Luồng 1: Chụp ảnh thô liên tục
                self.capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
                self.capture_thread.start()

                # Luồng 2: Chạy AI inference
                self.inference_task = asyncio.create_task(
                    self._inference_loop(model, db_collection)
                )

                # Luồng 3: Nhịp đập Telemetry (Gửi trạng thái liên tục bất kể AI có chạy hay không)
                self.telemetry_task = asyncio.create_task(self._telemetry_heartbeat())

                return my_session
            except Exception as e:
                # Nếu khởi động lỗi → Phải XÓA viewer_id ngay lập tức
                if viewer_id in self.active_viewers:
                    self.active_viewers.remove(viewer_id)
                logger.error(f"Failed to start camera session. Remaining: {len(self.active_viewers)}. Error: {e}")
                raise e

    async def stop(self, viewer_id: str, session_id: Optional[int] = None):
        """
        Decrements viewers_count and stops the pipeline when no viewers remain.

        Session guard: if session_id doesn't match the current session,
        this stop signal is from an outdated generator -> ignore hardware control.

        Multi-viewer: if other viewers are still active, only remove current ID.
        """

        cap_to_release = None
        thread_to_join = None

        async with self.lock:
            # ── LUÔN xóa ID khỏi danh sách khi rời đi ──
            if viewer_id in self.active_viewers:
                self.active_viewers.remove(viewer_id)
                logger.info(f"Viewer left (v_id={viewer_id}). Remaining: {len(self.active_viewers)}")
            
            # ── SESSION GUARD: Chỉ cho phép phiên hiện tại điều khiển phần cứng ──
            if session_id is not None and session_id != self._session_id:
                return

            # Nếu vẫn còn người xem khác → không tắt phần cứng
            if len(self.active_viewers) > 0:
                return

            if not self.is_running:
                return

            logger.info(f"Last viewer left session={session_id}. Stopping pipeline...")
            self.is_running = False
            self.camera_status = "Inactive"
            self.is_connected = False

            # Signal _capture_loop thoát NGAY LẬP TỨC (không chờ sleep timeout)
            self._stop_event.set()

            # Hủy các async task
            if self.inference_task:
                self.inference_task.cancel()
            if hasattr(self, "telemetry_task") and self.telemetry_task:
                self.telemetry_task.cancel()

            # Lấy tham chiếu nặng rồi đặt về None TRONG lock
            # → lock được nhả ngay, start() mới không phải chờ driver
            with self.cap_lock:
                cap_to_release = self.cap
                self.cap = None
            thread_to_join = self.capture_thread

            # Xóa bộ nhớ đệm
            self.raw_frame = None
            self.latest_frame = None
            self.logged_ids.clear()
            self.track_history.clear()
            logger.info("State cleared. Releasing hardware resources in background...")

        # ── Cleanup nặng NGOÀI lock → FIRE AND FORGET ─────────────────────
        # cap.release()  → OpenCV/FFMPEG đóng socket (3-7s trên Windows)
        # thread.join()  → chờ _capture_loop thoát (< 10ms nhờ _stop_event)
        # Dùng create_task để generator thoát NGAY LẬP TỨC, không bị block 6-8s
        self._hw_released_event.clear()  # Đánh dấu phần cứng đang bận
        asyncio.create_task(self._background_cleanup(cap_to_release, thread_to_join, session_id))

    async def _background_cleanup(self, cap, thread, session_id):
        """Clean up heavy resources (OpenCV Release, Thread Join) in the background"""

        try:
            logger.info(f"Background cleanup session={session_id}: Starting...")
            loop = asyncio.get_event_loop()
            
            # Chạy song song cap.release() và thread.join() để tối ưu thời gian
            cleanup_tasks = []
            
            def locked_release(c):
                with self.cap_lock:
                    if c is not None:
                        logger.info(f"Background cleanup session={session_id}: Release starting...")
                        c.release()
                        logger.info(f"Background cleanup session={session_id}: Release finished.")

            if cap:
                logger.info(f"Background cleanup session={session_id}: Scheduling VideoCapture release...")
                cleanup_tasks.append(loop.run_in_executor(None, locked_release, cap))
            if thread and thread.is_alive():
                logger.info(f"Background cleanup session={session_id}: Joining capture thread...")
                cleanup_tasks.append(
                    loop.run_in_executor(None, lambda: thread.join(timeout=3))
                )
            if cleanup_tasks:
                await asyncio.gather(*cleanup_tasks)
                
            logger.info(f"Background cleanup session={session_id}: FINISHED. Resources fully released.")
        except Exception as e:
            logger.error(f"Background cleanup error (session={session_id}): {e}")
        finally:
            # QUAN TRỌNG: Đánh dấu phần cứng đã tự do để phiên start() tiếp theo có thể chạy
            self._hw_released_event.set()

    # ──────────────────────────────────────────────────────────────────────
    # SWITCH CAMERA
    # ──────────────────────────────────────────────────────────────────────

    async def switch_camera(self, new_source_id: str):
        """Switch to a different camera source without dropping the MJPEG stream connection"""

        # Làm mới danh sách camera từ .env để hỗ trợ Hot-Reload và Friendly Names
        self.camera_sources = self._load_camera_sources()

        if new_source_id not in self.camera_sources:
            logger.error(f"Invalid camera source ID: {new_source_id}")
            return False

        if new_source_id == self.current_source_id and self.is_connected:
            logger.info(f"Already connected to {new_source_id}")
            return True

        async with self.lock:
            self.camera_status = "Connecting"
            logger.info(f"Switching camera to {new_source_id}...")

            # Hiển thị màn hình chờ ngay lập tức
            self.placeholder_frame = self._create_placeholder_frame(
                f"SWITCHING TO {new_source_id}..."
            )
            self.latest_frame = None
            self.is_connected = False

            # Giải phóng camera hiện tại và xóa sạch bộ đệm một cách an toàn (dùng lock)
            with self.cap_lock:
                if self.cap:
                    self.cap.release()
                    self.cap = None

            self.current_source_id = new_source_id
            self.raw_frame = None
            self.latest_frame = None # XÓA SẠCH ẢNH CŨ
            
            logger.info(f"Switching state updated. Awaiting reconnection to: {new_source_id}")
            return True

    # ──────────────────────────────────────────────────────────────────────
    # INTERNAL LOOPS
    # ──────────────────────────────────────────────────────────────────────

    def _capture_loop(self):
        """Continuous camera frame capture with auto-reconnect"""

        retry_interval = 5

        # Dùng _stop_event.is_set() → Event.wait() wake thread NGAY LẬP TỨC
        while not self._stop_event.is_set():

            # ── Reconnect nếu chưa có cap ──────────────────────────────
            if self.cap is None or not self.cap.isOpened():
                self.is_connected = False

                if self._stop_event.is_set():
                    break

                self.camera_status = "Connecting"

                # Chốt chặn ID tại thời điểm này để tránh race khi switch cam
                target_id = self.current_source_id
                cam_info = self.camera_sources.get(target_id, {"url": "0", "name": "Unknown"})
                source = cam_info["url"]

                try:
                    source_param = int(source)
                    # Webcam nội bộ - Sử dụng biến tạm và khóa để tránh race condition
                    temp_cap = cv2.VideoCapture(source_param)
                    if temp_cap is not None:
                        # Ép độ phân giải HD cho webcam nội bộ
                        temp_cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                        temp_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                    
                    with self.cap_lock:
                        self.cap = temp_cap
                except ValueError:
                    # RTSP Stream - Ép dùng FFMPEG và UDP để ổn định hơn
                    temp_cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
                    if temp_cap is not None:
                        # Tối ưu buffer cho RTSP (chỉ lấy frame mới nhất)
                        temp_cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    
                    with self.cap_lock:
                        self.cap = temp_cap

                if self.cap is not None and self.cap.isOpened():
                    # Nếu trong lúc đang kết nối mà user đã đổi sang Cam khác
                    if target_id != self.current_source_id:
                        logger.warning(
                            f"ID changed {target_id}→{self.current_source_id} during connect. Releasing."
                        )
                        with self.cap_lock:
                            if self.cap:
                                self.cap.release()
                                self.cap = None
                        continue

                    self.is_connected = True
                    # KHÔNG set Streaming ở đây, hãy đợi frame đầu tiên thành công
                    logger.info(
                        f"SUCCESS: Connected to {target_id} ({cam_info['name']}) using source: {source}"
                    )
                else:
                    self.is_connected = False
                    self.camera_status = "Error"
                    logger.error(
                        f"FAILURE: Could not open {target_id} ({source}). "
                        f"Retrying in {retry_interval}s..."
                    )
                    # Event.wait(timeout) → thoát < 10ms nếu stop được yêu cầu
                    # thay vì for+sleep block cứng tối đa 5 giây
                    if self._stop_event.wait(timeout=retry_interval):
                        break
                    continue

            # ── Đọc frame ───────────────────────────────────────────────
            if self.is_connected:
                source_url = self.camera_sources.get(self.current_source_id, {"url": "0"})["url"]
                is_rtsp = not source_url.isdigit()

                if is_rtsp and self.cap is not None:
                    # Với RTSP, ta cần đọc cạn buffer để lấy frame mới nhất, tránh delay tích tụ
                    with self.cap_lock:
                        if self.cap is not None:
                            for _ in range(5): # Đọc lướt 5 frame
                                if self.cap is not None:
                                    self.cap.grab()

                # Lưu tham chiếu cục bộ để tránh race condition với stop()
                with self.cap_lock:
                    cap = self.cap
                    if cap is None:
                        continue
                    success, frame = cap.read()
                if success:
                    # CHỈ set Streaming khi đã có frame thực tế
                    self.camera_status = "Streaming"

                    # --- AUTO-ROTATE: Tự động xoay hình nếu là hình dọc (Portrait to Landscape) ---
                    h, w = frame.shape[:2] 
                    if h > w:
                        frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)

                    self.raw_frame = frame
                    
                    # Tính toán Capture FPS
                    self.capture_frame_count += 1
                    elapsed_time = time.time() - self.capture_fps_start_time
                    if elapsed_time >= 1.0:
                        self.capture_fps = round(self.capture_frame_count / elapsed_time, 1)
                        self.capture_frame_count = 0
                        self.capture_fps_start_time = time.time()

                    # Không sleep khi dùng RTSP để đảm bảo tốc độ cao nhất
                    if not is_rtsp:
                        time.sleep(0.001)
                else:
                    logger.warning(f"Connection lost for {self.current_source_id}. Reconnecting...")
                    self.is_connected = False
                    self.camera_status = "Error"
                    
                    with self.cap_lock:
                        if self.cap:
                            self.cap.release()
                            self.cap = None
                    
                    self.latest_frame = None
                    # Dùng event.wait() thay vì time.sleep(1) cứng
                    if self._stop_event.wait(timeout=1):
                        break

        logger.info("_capture_loop exited cleanly.")

    async def _inference_loop(self, model, db_collection):
        """AI inference and tracking loop"""

        # Traffic Stats Variables
        last_traffic_log_time = time.time()
        safe_count_buffer = 0
        violator_count_buffer = 0
        counted_safe_ids = set()
        traffic_coll = db_collection.database[setting.TRAFFIC_STATS_COLLECTION]

        try:
            while self.is_running:
                # Nếu camera đang mất kết nối hoặc chưa có frame, chờ đợi và xóa ảnh đệm
                if not self.is_connected or self.raw_frame is None:
                    self.latest_frame = None # Đảm bảo không có ảnh cũ
                    await asyncio.sleep(0.1)
                    continue

                frame = self.raw_frame.copy()

                # Chạy AI Inference
                # Tối ưu: Nếu là RTSP (delay cao), dùng imgsz nhỏ hơn để tăng tốc
                source_url = self.camera_sources.get(self.current_source_id, {"url": "0"})["url"]
                current_imgsz = 416 if not source_url.isdigit() else 640

                results = await run_in_threadpool(
                    model.track,
                    frame,
                    persist=True,
                    tracker=str(self.tracker_config_path),
                    imgsz=current_imgsz,
                    conf=setting.VIOLATION_THRESHOLD,
                    iou=0.5,
                    verbose=False,
                    device=0,
                    half=True,
                )

                annotated_frame, latest_all_detections, _ = annotated_helmet_frame(frame, results)

                # Cập nhật bộ đệm stream
                ret, buffer = cv2.imencode(".jpg", annotated_frame)
                if ret:
                    self.latest_frame = buffer.tobytes()

                # TÍNH TOÁN AI FPS
                self.ai_frame_count += 1
                elapsed_time = time.time() - self.ai_fps_start_time
                if elapsed_time >= 1.0: # Mỗi giây gửi một lần
                    self.ai_fps = round(self.ai_frame_count / elapsed_time, 1)
                    self.ai_frame_count = 0
                    self.ai_fps_start_time = time.time()

                # LOGIC VOTING XÁC NHẬN VI PHẠM
                confirmed_violators = []
                
                for det in latest_all_detections:
                    t_id = det.track_id
                    if t_id is None:
                        continue
                    # 1. Lưu lịch sử class của ID này (tối đa 8 frame gần nhất)
                    if t_id not in self.track_history:
                        self.track_history[t_id] = deque(maxlen=8)
                    self.track_history[t_id].append(det.class_id)

                    # 2. Kiểm tra nếu ID này chưa từng bị log vi phạm
                    if t_id not in self.logged_ids:
                        # 3. CHỈ XÁC NHẬN VI PHẠM NẼU:
                        # - Đã quan sát được ít nhất 3 frame
                        # - Trong đó có trên 60% số frame báo là "Không mũ" (class_id = 1)
                        history = list(self.track_history[t_id])
                        if len(history) >= 3 and (history.count(1) / len(history)) >= 0.6:
                            confirmed_violators.append(det)
                            self.logged_ids.add(t_id)
                            violator_count_buffer += 1 # Đồng bộ với Traffic Stats

                if confirmed_violators:
                    asyncio.create_task(
                        save_violation_backtask(
                            annotated_frame.copy(),
                            len(confirmed_violators),
                            confirmed_violators,
                            db_collection,
                            manager,
                        )
                    )

                # Traffic Stats Aggregation
                current_ids = {d.track_id for d in latest_all_detections if d.track_id is not None}

                # Xác định người an toàn: Đã rời khỏi khung hình, từng xuất hiện >= 3 frame, và không vi phạm
                lost_ids = set(self.track_history.keys()) - current_ids
                for tid in lost_ids:
                    if tid not in self.logged_ids and tid not in counted_safe_ids:
                        if len(self.track_history[tid]) >= 3:
                            counted_safe_ids.add(tid)
                            safe_count_buffer += 1

                # Dọn dẹp track_history (Fix memory leak: chỉ giữ lại ID đang trên màn hình)
                if len(self.track_history) > 100:
                    self.track_history = {
                        tid: hist
                        for tid, hist in self.track_history.items()
                        if tid in current_ids
                    }

                # Gửi lên DB mỗi 60 giây
                current_time = time.time()
                if current_time - last_traffic_log_time >= 60.0:
                    if safe_count_buffer > 0 or violator_count_buffer > 0:
                        traffic_doc = {
                            "timestamp": datetime.now(),
                            "safe_count": safe_count_buffer,
                            "violation_count": violator_count_buffer
                        }
                        asyncio.ensure_future(traffic_coll.insert_one(traffic_doc))
                        
                    safe_count_buffer = 0
                    violator_count_buffer = 0
                    counted_safe_ids.clear() # Reset set này mỗi phút để giải phóng RAM
                    last_traffic_log_time = current_time

                await asyncio.sleep(0.001)
        except asyncio.CancelledError:
            logger.info("_inference_loop cancelled.")
        except Exception as e:
            logger.error(f"Inference error: {e}")
        finally:
            # Flush on Exit
            if safe_count_buffer > 0 or violator_count_buffer > 0:
                try:
                    traffic_doc = {
                        "timestamp": datetime.now(),
                        "safe_count": safe_count_buffer,
                        "violation_count": violator_count_buffer
                    }
                    # Chạy ngầm việc insert để không cản trở quá trình dọn dẹp
                    asyncio.ensure_future(traffic_coll.insert_one(traffic_doc))
                    logger.info(f"Flushed final traffic stats before exit: {traffic_doc}")
                except Exception as e:
                    logger.error(f"Failed to flush final traffic stats: {e}")

    async def _telemetry_heartbeat(self):
        """Dedicated task to send telemetry regardless of AI or Camera state"""
        try:
            while self.is_running:
                try:
                    cam_info = self.camera_sources.get(self.current_source_id, {"name": "Unknown"})
                    res_str = "N/A"
                    if self.raw_frame is not None:
                        res_str = f"{self.raw_frame.shape[1]}x{self.raw_frame.shape[0]}"

                    await manager.broadcast(
                        {
                            "type": "telemetry",
                            "status": self.camera_status,
                            "fps": self.ai_fps if self.camera_status == "Streaming" else 0,
                            "capture_fps": self.capture_fps if self.camera_status == "Streaming" else 0,
                            "cam_name": cam_info["name"],
                            "resolution": res_str,
                        }
                    )
                except Exception as e:
                    logger.error(f"Telemetry heartbeat error: {e}")
                await asyncio.sleep(1.0) # Gửi đều đặn mỗi giây
        except asyncio.CancelledError:
            logger.info("_telemetry_heartbeat cancelled.")


# ──────────────────────────────────────────────────────────────────────────────
# Singleton
# ──────────────────────────────────────────────────────────────────────────────

global_camera = GlobalCamera()


async def generated_video_frames(model, db_collection, viewer_id: str):
    """
    Generator function that yields video frames from the camera.
    Updates the session stats and logs violations to the database.
    """
    my_session = None
    try:
        # Nhận session_id → đây là "token" gắn liền với vòng đời của generator này
        my_session = await global_camera.start(model, db_collection, viewer_id)

        while True:
            # 1. Kiểm tra nếu ID này đã bị xóa khỏi danh sách (do API Stop hoặc lỗi)
            if viewer_id not in global_camera.active_viewers:
                logger.info(f"Viewer v_id={viewer_id} no longer in active list. Exiting generator.")
                break

            # 2. Kiểm tra nếu session hiện tại đã bị cancel hoặc thay thế
            if global_camera._session_cancel_event.is_set() or global_camera._session_id != my_session:
                logger.info(f"Generator session={my_session} exiting (cancelled or superseded)")
                break

            # Ưu tiên lấy frame từ Camera
            if global_camera.is_running and global_camera.is_connected and global_camera.latest_frame:
                frame_to_send = global_camera.latest_frame
            else:
                # Nếu đang chuyển cam hoặc mất kết nối, gửi Placeholder Frame để giữ luồng
                frame_to_send = global_camera.placeholder_frame

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame_to_send + b"\r\n"
            )

            await asyncio.sleep(0.03) # Giảm tải cho loop streaming
    finally:
        # Luôn thực hiện dọn dẹp theo ID khi generator thoát
        await global_camera.stop(viewer_id, my_session)


async def stop_video_frames(viewer_id: str):
    """
    Stop signal from API for a specific viewer.
    """
    # Xóa frame ngay lập tức để tránh hiện frame cuối bị đóng băng
    global_camera.latest_frame = None
    
    logger.info(f"API Stop request received for v_id={viewer_id}")

    # Xóa viewer khỏi danh sách ngay lập tức. Nếu là người cuối cùng, stop hardware sẽ chạy.
    await global_camera.stop(viewer_id)

    # Nếu sau khi xóa mà không còn ai xem, set cancel event
    if len(global_camera.active_viewers) == 0:
        if global_camera._session_cancel_event:
            global_camera._session_cancel_event.set()
        logger.info("ACTION: No active viewers remaining. Hardware shutdown signaled.")
    else:
        logger.info(f"ACTION: {len(global_camera.active_viewers)} viewers remaining. Hardware remains ON.")
