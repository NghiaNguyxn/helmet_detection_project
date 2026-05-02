import cv2
import time
import logging
import asyncio
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
        self.results = None  # Lưu kết quả AI mới nhất

        # ── MULTI-VIEWER COUNTER ──────────────────────────────────────────
        # Theo dõi số lượng người đang xem stream cùng lúc.
        # Pipeline chỉ dừng khi viewers_count về 0 (tất cả đã disconnect).
        # → Cho phép nhiều tab/user cùng xem mà không làm gián đoạn nhau.
        self.viewers_count: int = 0

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
        self.stop_requested = False  # Flag ra hiệu cho generator thoát

        # Thông số FPS và Telemetry
        self.fps = 0
        self.frame_count = 0
        self.fps_start_time = time.time()

        # Màn hình chờ (Placeholder) khi đang chuyển cam
        self.placeholder_frame = self._create_placeholder_frame("INITIALIZING...")

        # LOGIC THEO DÕI LỊCH SỬ THEO ID ĐỂ CHỐNG NHẢY (Flickering)
        self.track_history: dict[int, deque] = {} # {id: deque([class_id, class_id, ...], maxlen=10)}
        self.logged_ids = set()

        # Đường dẫn file config tracker
        self.tracker_config_path = Path(__file__).parent.parent / "core" / "custom_tracker.yaml"

    # ──────────────────────────────────────────────────────────────────────
    # HELPERS
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

    async def start(self, model, db_collection, source_id: str = None) -> int:
        """
        Tăng viewers_count và khởi động pipeline nếu chưa chạy.
        Trả về session_id để caller dùng khi gọi stop().

        Multi-viewer: nếu pipeline đã chạy, chỉ tăng viewers_count và return.
        Session guard: mỗi lần pipeline khởi động MỚI, session_id tăng lên,
        vô hiệu hoá mọi stop() đến từ các generator của phiên trước.
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

            # ── MULTI-VIEWER: Tăng counter dù pipeline đang chạy hay không ──
            self.viewers_count += 1
            logger.info(
                f"Viewer joined (viewers={self.viewers_count}, "
                f"session={self._session_id}, source={self.current_source_id})"
            )

            # Pipeline đang chạy → reuse, không khởi động lại
            if self.is_running:
                return self._session_id

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
            self.stop_requested = False
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

    async def stop(self, session_id: int):
        """
        Giảm viewers_count. Dừng pipeline khi không còn viewer nào.

        Session guard: nếu session_id không khớp với session hiện tại,
        stop() này đến từ một generator cũ (phiên trước) → bỏ qua hoàn toàn,
        KHÔNG giảm viewers_count của phiên mới.

        Multi-viewer: nếu vẫn còn viewer khác, chỉ giảm count, không dừng pipeline.
        """
        cap_to_release = None
        thread_to_join = None

        async with self.lock:
            # ── SESSION GUARD ────────────────────────────────────────────
            # stop() của generator cũ (session_id nhỏ hơn) bị bỏ qua.
            # Điều này xảy ra khi: user tắt → bật ngay → generator cũ
            # chạy finally → stop() nhưng pipeline mới đã được khởi động.
            if session_id != self._session_id:
                logger.info(
                    f"Ignoring stale stop() for session={session_id} "
                    f"(current session={self._session_id})"
                )
                return

            # ── MULTI-VIEWER: Giảm counter ───────────────────────────────
            if self.viewers_count > 0:
                self.viewers_count -= 1
            logger.info(
                f"Viewer left session={session_id}. Remaining: {self.viewers_count}"
            )

            # Vẫn còn viewer khác đang xem → giữ pipeline, không dừng
            if self.viewers_count > 0:
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
            cap_to_release = self.cap
            self.cap = None
            thread_to_join = self.capture_thread

            # Xóa bộ nhớ đệm
            self.raw_frame = None
            self.latest_frame = None
            self.results = None
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
        """Dọn dẹp tài nguyên nặng (OpenCV Release, Thread Join) trong background"""
        try:
            logger.info(f"Background cleanup session={session_id}: Starting...")
            loop = asyncio.get_event_loop()
            
            # Chạy song song cap.release() và thread.join() để tối ưu thời gian
            cleanup_tasks = []
            if cap:
                logger.info(f"Background cleanup session={session_id}: Releasing VideoCapture...")
                cleanup_tasks.append(loop.run_in_executor(None, cap.release))
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

            # Giải phóng camera hiện tại và xóa sạch bộ đệm
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
                    # Webcam nội bộ
                    self.cap = cv2.VideoCapture(source_param)
                    # Ép độ phân giải HD cho webcam nội bộ
                    self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                    self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                except ValueError:
                    # RTSP Stream - Ép dùng FFMPEG và UDP để ổn định hơn
                    self.cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
                    # Tối ưu buffer cho RTSP (chỉ lấy frame mới nhất)
                    self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

                if self.cap.isOpened():
                    # Nếu trong lúc đang kết nối mà user đã đổi sang Cam khác
                    if target_id != self.current_source_id:
                        logger.warning(
                            f"ID changed {target_id}→{self.current_source_id} during connect. Releasing."
                        )
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

                if is_rtsp:
                    # Với RTSP, ta cần đọc cạn buffer để lấy frame mới nhất, tránh delay tích tụ
                    for _ in range(5): # Đọc lướt 5 frame
                        self.cap.grab()

                # Lưu tham chiếu cục bộ để tránh race condition với stop()
                # stop() có thể set self.cap = None bất kỳ lúc nào ngoài lock
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
                    # Không sleep khi dùng RTSP để đảm bảo tốc độ cao nhất
                    if not is_rtsp:
                        time.sleep(0.001)
                else:
                    logger.warning(f"Connection lost for {self.current_source_id}. Reconnecting...")
                    self.is_connected = False
                    self.camera_status = "Error"
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

                self.results = await run_in_threadpool(
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

                annotated_frame, latest_all_detections, _ = annotated_helmet_frame(frame, self.results)

                # Cập nhật bộ đệm stream
                ret, buffer = cv2.imencode(".jpg", annotated_frame)
                if ret:
                    self.latest_frame = buffer.tobytes()

                # TÍNH TOÁN FPS (Vẫn tính ở đây nhưng không gửi WebSocket ở đây nữa)
                self.frame_count += 1
                elapsed_time = time.time() - self.fps_start_time
                if elapsed_time >= 1.0: # Mỗi giây gửi một lần
                    self.fps = round(self.frame_count / elapsed_time, 1)
                    self.frame_count = 0
                    self.fps_start_time = time.time()

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

                # Dọn dẹp track_history để tránh tốn RAM (xóa các ID đã lâu không xuất hiện)
                if len(self.track_history) > 100:
                    current_ids = {
                        d.track_id for d in latest_all_detections if d.track_id is not None
                    }
                    self.track_history = {
                        tid: hist
                        for tid, hist in self.track_history.items()
                        if tid in current_ids or tid in self.logged_ids
                    }

                await asyncio.sleep(0.001)
        except asyncio.CancelledError:
            logger.info("_inference_loop cancelled.")
        except Exception as e:
            logger.error(f"Inference error: {e}")

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
                            "fps": self.fps if self.camera_status == "Streaming" else 0,
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


async def generated_video_frames(model, db_collection):
    """
    Asynchronous generator that yields camera frames or placeholders.

    Lifecycle:
      1. start() → returns a unique session_id for this session.
      2. Generator streams frames continuously until session is cancelled or superseded.
      3. finally → stop(session_id) only shuts down the pipeline if the session is still valid.
         If the user restarts before the old generator exits,
         the session_id won't match → stop() is ignored, the new pipeline is unaffected.
    """
    # KHÔNG reset stop_requested ở đây — start() sẽ tự reset trong lock nếu cần
    # Reset ở đây gây BUG: generator mới xóa signal → generator cũ thành zombie

    # Nhận session_id → đây là "token" gắn liền với vòng đời của generator này
    my_session = await global_camera.start(model, db_collection)

    try:
        while True:
            # Kiểm tra TRƯỚC khi yield để không gửi frame cũ sau khi đã dừng
            # 1. Session bị cancel (user bấm tắt)
            # 2. Session bị thay thế (user bấm tắt rồi bật lại nhanh → session_id mới)
            if global_camera._session_cancel_event.is_set() or global_camera._session_id != my_session:
                logger.info(f"Generator session={my_session} exiting (cancelled or superseded by session={global_camera._session_id})")
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
        # stop() chỉ được gọi DUY NHẤT ở đây
        # Nếu user đã bấm bật lại → session mới > my_session → stop này bị bỏ qua
        await global_camera.stop(my_session)


def stop_video_frames():
    """Signal the generator to stop gracefully via a flag"""
    
    # Xóa frame ngay lập tức để tránh hiện frame cuối bị đóng băng
    global_camera.latest_frame = None
    
    # Bật cả 2 signal để đảm bảo generator thoát ngay lập tức:
    # 1. stop_requested: flag tương thích cũ
    # 2. _session_cancel_event: Event chính xác cho session hiện tại
    global_camera.stop_requested = True
    if global_camera._session_cancel_event:
        global_camera._session_cancel_event.set()
    
    logger.info("Stop signal sent to generator. Cancel event SET.")