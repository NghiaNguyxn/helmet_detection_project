import cv2
import time
import logging
import asyncio
from datetime import datetime
import threading
import yaml
import os
import numpy as np
import tempfile
from pathlib import Path
from typing import Optional
from collections import deque
from dotenv import dotenv_values
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import inspect
from sqlmodel import Session
from SourceCode.BE.app.core.config import setting
from SourceCode.BE.app.database.sql_database import engine
from SourceCode.BE.app.utils.drawing import annotated_helmet_frame
from SourceCode.BE.app.services.violation_service import save_violation_backtask
from SourceCode.BE.app.core.websocket_manager import manager
from SourceCode.BE.app.services import alert_service
from SourceCode.BE.app.services import camera_service
from SourceCode.BE.app.schemas.alert_schema import SecurityAlertCreate
from SourceCode.BE.app.enums.camera_source_type import CameraSourceType

logger = logging.getLogger(__name__)

# Tối ưu hóa cho RTSP: Giảm độ trễ bằng cách ép OpenCV dùng FFMPEG với tham số luồng thấp
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;udp"

class GlobalCamera:
    def __init__(self):
        """Initialize the shared camera pipeline state."""

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
        self._capture_pause_event = threading.Event()
        
        # asyncio.Event để điều phối async flow
        self._session_cancel_event = None
        self._hw_released_event = None

        # Quản lý nguồn Camera & Thông tin vận hành
        self.camera_sources: dict[str, dict] = self._load_camera_sources()
        self.current_source_id = "CAM_1"  # Mặc định là CAM_1
        if self.current_source_id not in self.camera_sources:
            self.current_source_id = next(iter(self.camera_sources.keys()), "CAM_1")
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
        self.spatial_violation_history = deque(maxlen=30)
        self.logged_ids = set()
        self.recent_violation_events = deque(maxlen=100)
        self.demo_last_violation_log_time = 0.0

        # Đường dẫn file config tracker
        self.tracker_config_path = Path(tempfile.gettempdir()) / "helmet_detection_tracker.yaml"

    async def force_stop(self, user, session):
        """Force-stop all viewers, release camera hardware, and broadcast an alert."""
        await self.force_stop_pipeline()
            
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
    # PIPELINE CHÍNH
    # ──────────────────────────────────────────────────────────────────────

    async def force_stop_pipeline(self):
        """Stop the camera pipeline without creating a manual alert."""

        self.active_viewers.clear()
        await self.stop("FORCE_STOP_SIGNAL")

        if self._session_cancel_event:
            self._session_cancel_event.set()

    def _load_camera_sources(self) -> dict[str, dict]:
        """Load active camera sources from DB, falling back to CAM_X entries in .env."""

        sources = {}
        try:
            if inspect(engine).has_table("cameras"):
                with Session(engine) as session:
                    db_cameras = camera_service.list_active_cameras(session)
                    if db_cameras:
                        for camera in db_cameras:
                            sources[camera.code] = {
                                "id": camera.id,
                                "url": camera.source_url,
                                "name": camera.name,
                                "location": camera.location,
                                "source_type": camera.source_type.value if hasattr(camera.source_type, "value") else camera.source_type,
                                "is_active": camera.is_active,
                                "last_status": camera.last_status,
                            }
                        logger.info(f"Loaded camera sources from DB: {sources}")
                        return sources
        except Exception as e:
            logger.error(f"Error reading camera sources from DB: {e}")

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
                            "name": name,
                            "source_type": CameraSourceType.WEBCAM.value if url.isdigit() else CameraSourceType.RTSP.value,
                            "is_active": True,
                            "last_status": "unchecked",
                        }
            # logger.info(f"--- DEBUG: Final Sources Dictionary: {sources} ---")
        except Exception as e:
            logger.error(f"Error reading .env file: {e}")

        # Nếu không tìm thấy gì, mặc định dùng webcam 0
        if not sources:
            sources["CAM_1"] = {
                "url": "0",
                "name": "Default Webcam",
                "source_type": CameraSourceType.WEBCAM.value,
                "is_active": True,
                "last_status": "unchecked",
            }

        logger.info(f"Loaded camera sources: {sources}")
        return sources

    def reload_sources(self):
        """Refresh the cached camera sources after admin camera changes."""

        old_source_id = self.current_source_id
        self.camera_sources = self._load_camera_sources()
        if self.current_source_id not in self.camera_sources:
            self.current_source_id = next(iter(self.camera_sources.keys()), "CAM_1")
            logger.warning(
                "Current source %s no longer exists. Fallback to %s",
                old_source_id,
                self.current_source_id,
            )

    def _get_camera_info(self, source_id: str | None = None) -> dict:
        target_id = source_id or self.current_source_id
        return self.camera_sources.get(
            target_id,
            {
                "url": "0",
                "name": "Unknown",
                "source_type": CameraSourceType.WEBCAM.value,
                "is_active": True,
                "last_status": "unchecked",
            },
        )

    def _source_type(self, cam_info: dict) -> str:
        return cam_info.get("source_type") or CameraSourceType.WEBCAM.value

    def _is_rtsp_source(self, cam_info: dict) -> bool:
        return self._source_type(cam_info) == CameraSourceType.RTSP.value

    def _is_video_file_source(self, cam_info: dict) -> bool:
        return self._source_type(cam_info) == CameraSourceType.VIDEO_FILE.value

    def _open_capture(self, cam_info: dict):
        source = cam_info["url"]
        source_type = self._source_type(cam_info)

        if source_type == CameraSourceType.WEBCAM.value:
            source_param = int(source)
            temp_cap = cv2.VideoCapture(source_param)
            if temp_cap is not None:
                temp_cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                temp_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            return temp_cap

        if source_type == CameraSourceType.RTSP.value:
            temp_cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
            if temp_cap is not None:
                temp_cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            return temp_cap

        if source_type == CameraSourceType.VIDEO_FILE.value:
            return cv2.VideoCapture(str(camera_service.resolve_demo_video_path(source)))

        return cv2.VideoCapture(source)

    def _bbox_iou(self, box_a: dict, box_b: dict) -> float:
        x_left = max(box_a["x1"], box_b["x1"])
        y_top = max(box_a["y1"], box_b["y1"])
        x_right = min(box_a["x2"], box_b["x2"])
        y_bottom = min(box_a["y2"], box_b["y2"])

        if x_right <= x_left or y_bottom <= y_top:
            return 0.0

        intersection = (x_right - x_left) * (y_bottom - y_top)
        area_a = max((box_a["x2"] - box_a["x1"]) * (box_a["y2"] - box_a["y1"]), 1)
        area_b = max((box_b["x2"] - box_b["x1"]) * (box_b["y2"] - box_b["y1"]), 1)
        return intersection / (area_a + area_b - intersection)

    def _bbox_center_distance(self, box_a: dict, box_b: dict) -> float:
        center_a_x = (box_a["x1"] + box_a["x2"]) / 2
        center_a_y = (box_a["y1"] + box_a["y2"]) / 2
        center_b_x = (box_b["x1"] + box_b["x2"]) / 2
        center_b_y = (box_b["y1"] + box_b["y2"]) / 2
        return ((center_a_x - center_b_x) ** 2 + (center_a_y - center_b_y) ** 2) ** 0.5

    def _is_duplicate_recent_violation(self, det, camera_code: str, now: float) -> bool:
        # ByteTrack đôi khi đổi track_id khi người bị che, quay người, hoặc camera RTSP
        # bị drop frame. Vì vậy cần chống trùng bằng vị trí bbox trong một khoảng ngắn,
        # không chỉ dựa vào track_id.
        dedup_seconds = setting.VIOLATION_DEDUP_SECONDS
        current_bbox = det.bbox.model_dump()
        fresh_events = deque(maxlen=self.recent_violation_events.maxlen)

        is_duplicate = False
        for event in self.recent_violation_events:
            if now - event["timestamp"] > dedup_seconds:
                continue

            fresh_events.append(event)
            if event["camera_code"] != camera_code:
                continue

            same_track = det.track_id is not None and event.get("track_id") == det.track_id
            iou = self._bbox_iou(current_bbox, event["bbox"])
            distance = self._bbox_center_distance(current_bbox, event["bbox"])
            if (
                same_track
                or iou >= setting.VIOLATION_DEDUP_IOU_THRESHOLD
                or distance <= setting.VIOLATION_DEDUP_CENTER_DISTANCE
            ):
                is_duplicate = True

        self.recent_violation_events = fresh_events
        return is_duplicate

    def _remember_recent_violation(self, det, camera_code: str, now: float):
        # Lưu footprint nhỏ của violation đã log để lọc các track_id mới nhưng
        # thực chất vẫn là cùng một người trong vài giây tiếp theo.
        self.recent_violation_events.append(
            {
                "timestamp": now,
                "camera_code": camera_code,
                "track_id": det.track_id,
                "bbox": det.bbox.model_dump(),
            }
        )

    def _has_stable_spatial_violation(self, det, now: float) -> bool:
        # Khi tracker đổi ID liên tục, voting theo track_id sẽ không đủ 3 frame.
        # Voting theo vị trí bbox giúp xác nhận cùng một vùng no_helmet ổn định
        # qua vài frame liên tiếp, kể cả khi ByteTrack cấp ID mới.
        current_bbox = det.bbox.model_dump()
        self.spatial_violation_history.append(
            {
                "timestamp": now,
                "bbox": current_bbox,
                "class_id": det.class_id,
            }
        )

        nearby_no_helmet_count = 0
        fresh_history = deque(maxlen=self.spatial_violation_history.maxlen)
        for event in self.spatial_violation_history:
            if now - event["timestamp"] > setting.SPATIAL_VOTE_WINDOW_SECONDS:
                continue
            fresh_history.append(event)
            if event["class_id"] != 1:
                continue
            iou = self._bbox_iou(current_bbox, event["bbox"])
            distance = self._bbox_center_distance(current_bbox, event["bbox"])
            if (
                iou >= setting.SPATIAL_VOTE_IOU_THRESHOLD
                or distance <= setting.SPATIAL_VOTE_CENTER_DISTANCE
            ):
                nearby_no_helmet_count += 1

        self.spatial_violation_history = fresh_history
        return nearby_no_helmet_count >= setting.SPATIAL_VOTE_MIN_COUNT

    def _create_placeholder_frame(self, text: str) -> bytes:
        """Create a placeholder JPEG frame so the MJPEG stream remains continuous."""

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
        """Create or update the tracker YAML config from runtime settings."""

        config = {
            "tracker_type": "bytetrack",
            "track_high_thresh": setting.TRACK_HIGH_THRESH,
            "track_low_thresh": setting.TRACK_LOW_THRESH,
            "new_track_thresh": setting.NEW_TRACK_THRESH,
            "track_buffer": setting.TRACK_BUFFER,
            "match_thresh": setting.MATCH_THRESH,
            "fuse_score": True # Ép buộc True để tránh lỗi thư viện
        }
        
        with open(self.tracker_config_path, 'w', encoding='utf-8') as f:
            yaml.dump(config, f)
        logger.info(f"Tracker config updated: buffer={setting.TRACK_BUFFER}")

    # ──────────────────────────────────────────────────────────────────────
    # VÒNG ĐỜI PIPELINE: start / stop
    # ──────────────────────────────────────────────────────────────────────

    async def start(self, model, db_collection, viewer_id: str, source_id: str = None) -> int:
        """
        Register a viewer and start the pipeline if it is not already running.
        Return the session_id that the caller should pass to stop().

        Multi-viewer: if the pipeline is already running, only register viewer_id.
        Session guard: every new hardware start increments session_id so stale
        generators cannot stop a newer session.
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
                self.spatial_violation_history.clear()
                self.recent_violation_events.clear()
                self.demo_last_violation_log_time = 0.0
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

                # Luồng 2: Chạy suy luận AI
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
        Remove the current viewer and stop the pipeline only when no viewers remain.

        Session guard: if session_id does not match the current session, this is a
        stale stop signal and must not control hardware.

        Multi-viewer: if other viewers are still active, only remove the current ID.
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
            self.spatial_violation_history.clear()
            self.recent_violation_events.clear()
            logger.info("State cleared. Releasing hardware resources in background...")
            self._hw_released_event.clear()  # Đánh dấu phần cứng đang bận

        # ── Cleanup nặng NGOÀI lock → FIRE AND FORGET ─────────────────────
        # cap.release()  → OpenCV/FFMPEG đóng socket (3-7s trên Windows)
        # thread.join()  → chờ _capture_loop thoát (< 10ms nhờ _stop_event)
        # Dùng create_task để generator thoát NGAY LẬP TỨC, không bị block 6-8s
        asyncio.create_task(self._background_cleanup(cap_to_release, thread_to_join, session_id))

    async def _background_cleanup(self, cap, thread, session_id):
        """Release heavy OpenCV/thread resources in the background."""

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
    # CHUYỂN CAMERA
    # ──────────────────────────────────────────────────────────────────────

    async def _release_cap_only(self, cap, reason: str):
        """Release a detached VideoCapture handle without blocking the event loop."""

        try:
            if cap is None:
                return

            logger.info("Async VideoCapture release started (%s).", reason)
            loop = asyncio.get_event_loop()

            def locked_release():
                # cap.release() với RTSP/FFmpeg có thể block vài giây, nên chạy trong executor.
                with self.cap_lock:
                    cap.release()

            await loop.run_in_executor(None, locked_release)
            logger.info("Async VideoCapture release finished (%s).", reason)
        except Exception as e:
            logger.error("Async VideoCapture release failed (%s): %s", reason, e)
        finally:
            self._capture_pause_event.clear()

    async def switch_camera(self, new_source_id: str):
        """Switch to another camera source without dropping the MJPEG connection."""

        old_cap = None

        # Làm mới danh sách camera từ DB/.env để hỗ trợ thay đổi camera từ admin.
        self.reload_sources()

        if new_source_id not in self.camera_sources:
            logger.error(f"Invalid camera source ID: {new_source_id}")
            return False

        if new_source_id == self.current_source_id and self.is_connected:
            logger.info(f"Already connected to {new_source_id}")
            return True

        async with self.lock:
            self.camera_status = "Connecting"
            logger.info(f"Switching camera to {new_source_id}...")
            self._capture_pause_event.set()

            # Hiển thị màn hình chờ ngay lập tức
            self.placeholder_frame = self._create_placeholder_frame(
                f"SWITCHING TO {new_source_id}..."
            )
            self.latest_frame = None
            self.is_connected = False

            # Chỉ tách handle camera cũ ra khỏi state trong lock. Không gọi release()
            # tại đây vì RTSP/FFmpeg có thể block event loop vài giây.
            with self.cap_lock:
                old_cap = self.cap
                self.cap = None

            self.current_source_id = new_source_id
            self.raw_frame = None
            self.latest_frame = None  # XÓA SẠCH ẢNH CŨ
            self.track_history.clear()
            self.logged_ids.clear()
            self.spatial_violation_history.clear()
            self.recent_violation_events.clear()
            self.demo_last_violation_log_time = 0.0
            
            logger.info(f"Switching state updated. Awaiting reconnection to: {new_source_id}")

        if old_cap is not None:
            asyncio.create_task(self._release_cap_only(old_cap, f"switch:{new_source_id}"))
        else:
            self._capture_pause_event.clear()

        return True

    # ──────────────────────────────────────────────────────────────────────
    # CÁC VÒNG LẶP NỘI BỘ
    # ──────────────────────────────────────────────────────────────────────

    def _capture_loop(self):
        """
        Continuously capture raw frames from the current camera source.

        This runs in a dedicated thread because cv2.VideoCapture.read() can block
        on webcam drivers or RTSP sockets. The async inference loop only consumes
        self.raw_frame, so websocket/API handling is not blocked by camera I/O.
        """

        retry_interval = 5
        video_frame_interval = 0.0
        next_video_frame_time = 0.0

        # Dùng Event.wait(timeout) ở các đoạn retry để stop/switch có thể đánh thức
        # thread ngay, thay vì bị kẹt trong time.sleep() đủ 5 giây.
        while not self._stop_event.is_set():
            if self._capture_pause_event.is_set():
                # Khi switch camera, chờ handle cũ release xong rồi mới mở nguồn mới
                # để tránh tranh chấp driver/webcam hoặc socket RTSP.
                if self._stop_event.wait(timeout=0.05):
                    break
                continue

            if self.cap is None or not self.cap.isOpened():
                self.is_connected = False

                if self._stop_event.is_set():
                    break

                self.camera_status = "Connecting"
                # Chốt source_id tại thời điểm bắt đầu mở camera. Việc mở RTSP có thể
                # mất vài giây, trong lúc đó admin/user vẫn có thể switch camera.
                target_id = self.current_source_id
                cam_info = self._get_camera_info(target_id)
                source = cam_info["url"]

                try:
                    # Chọn cách mở theo source_type:
                    # - webcam: ép source_url sang int cho cv2.VideoCapture(0)
                    # - rtsp: dùng FFMPEG và buffer thấp để giảm delay
                    # - video_file: mở file demo như một camera giả lập
                    temp_cap = self._open_capture(cam_info)
                    with self.cap_lock:
                        self.cap = temp_cap
                except ValueError:
                    # Chỉ xảy ra khi camera webcam có source_url không phải số.
                    # Không crash pipeline; giữ loop retry để admin sửa config được.
                    logger.error("Invalid webcam source for %s: %s", target_id, source)
                    self.is_connected = False
                    self.camera_status = "Error"
                    if self._stop_event.wait(timeout=retry_interval):
                        break
                    continue

                if self.cap is not None and self.cap.isOpened():
                    # Nếu trong lúc mở camera mà current_source_id đã đổi, connection
                    # vừa mở là connection cũ. Phải release để tránh stream nhầm camera.
                    if target_id != self.current_source_id:
                        logger.warning(
                            "ID changed %s -> %s during connect. Releasing.",
                            target_id,
                            self.current_source_id,
                        )
                        with self.cap_lock:
                            if self.cap:
                                self.cap.release()
                                self.cap = None
                        continue

                    # Chưa set Streaming ở đây. Chỉ khi đọc được frame thật bên dưới
                    # thì telemetry mới được xem là đang streaming.
                    self.is_connected = True
                    if self._is_video_file_source(cam_info) and self.cap is not None:
                        # Video file không tự pace theo FPS như camera thật. Phải tự
                        # sleep theo FPS gốc để demo không bị tua nhanh.
                        source_fps = self.cap.get(cv2.CAP_PROP_FPS) or 0
                        source_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
                        source_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
                        source_frame_count = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
                        if source_fps <= 1:
                            source_fps = 30  # Mặc định 30 FPS nếu không đọc được FPS gốc
                        video_frame_interval = 1.0 / source_fps
                        next_video_frame_time = time.monotonic()
                        logger.info(
                            "Demo video metadata: source=%s fps=%.2f resolution=%sx%s frame_count=%s",
                            source,
                            source_fps,
                            source_width,
                            source_height,
                            source_frame_count,
                        )
                    else:
                        video_frame_interval = 0.0
                        next_video_frame_time = 0.0
                    logger.info(
                        "SUCCESS: Connected to %s (%s) using source: %s",
                        target_id,
                        cam_info.get("name", "Unknown"),
                        source,
                    )
                else:
                    # Camera/socket/file chưa mở được. Giữ pipeline sống và retry vì
                    # RTSP/webcam có thể online lại mà không cần restart app.
                    self.is_connected = False
                    self.camera_status = "Error"
                    logger.error(
                        "FAILURE: Could not open %s (%s). Retrying in %ss...",
                        target_id,
                        source,
                        retry_interval,
                    )
                    if self._stop_event.wait(timeout=retry_interval):
                        break
                    continue

            if self.is_connected:
                cam_info = self._get_camera_info()
                is_rtsp = self._is_rtsp_source(cam_info)

                if is_rtsp and self.cap is not None:
                    # RTSP thường bị tích buffer frame cũ. grab() vài frame trước khi
                    # read() giúp lấy frame mới hơn, giảm cảm giác live view bị trễ.
                    with self.cap_lock:
                        if self.cap is not None:
                            for _ in range(5):
                                if self.cap is not None:
                                    self.cap.grab()

                # Lưu tham chiếu cục bộ để tránh race condition với stop()
                with self.cap_lock:
                    cap = self.cap
                    if cap is None:
                        continue
                    success, frame = cap.read()

                if success:
                    # CHỈ set Streaming khi đã có frame thực tế.
                    self.camera_status = "Streaming"

                    # Một số camera/điện thoại trả frame dọc. UI đang tối ưu cho
                    # landscape nên xoay frame dọc sang ngang trước khi xử lý tiếp.
                    h, w = frame.shape[:2]
                    if h > w:
                        frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)

                    self.raw_frame = frame
                    
                    # Capture FPS đo tốc độ đọc frame từ camera, khác với AI FPS.
                    self.capture_frame_count += 1
                    elapsed_time = time.time() - self.capture_fps_start_time
                    if elapsed_time >= 1.0:
                        self.capture_fps = round(self.capture_frame_count / elapsed_time, 1)
                        self.capture_frame_count = 0
                        self.capture_fps_start_time = time.time()

                    if self._is_video_file_source(cam_info):
                        # Giữ tốc độ phát demo gần với FPS gốc của file.
                        next_video_frame_time += video_frame_interval
                        wait_time = next_video_frame_time - time.monotonic()
                        if wait_time > 0 and self._stop_event.wait(timeout=wait_time):
                            break
                    elif not is_rtsp:
                        # Webcam local có thể đọc rất nhanh, sleep nhẹ để tránh ăn CPU.
                        # RTSP bỏ sleep để giảm latency mạng.
                        time.sleep(0.001)
                else:
                    if self._is_video_file_source(cam_info) and self.cap is not None:
                        # Video demo cần hoạt động như camera luôn online. Khi đọc tới
                        # cuối file thì tua về frame đầu thay vì báo mất kết nối.
                        with self.cap_lock:
                            if self.cap is not None:
                                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        next_video_frame_time = time.monotonic()
                        logger.info("Looping demo video source %s", self.current_source_id)
                        continue

                    # Webcam/RTSP đọc frame lỗi: release handle cũ để vòng sau mở
                    # lại device/socket mới, tránh giữ một connection đã hỏng.
                    logger.warning("Connection lost for %s. Reconnecting...", self.current_source_id)
                    self.is_connected = False
                    self.camera_status = "Error"

                    with self.cap_lock:
                        if self.cap:
                            self.cap.release()
                            self.cap = None

                    self.latest_frame = None
                    # Dùng wait để stop/switch có thể ngắt thời gian chờ reconnect.
                    if self._stop_event.wait(timeout=1):
                        break

        logger.info("_capture_loop exited cleanly.")

    async def _inference_loop(self, model, db_collection):
        """Run AI inference, tracking, violation logging, and traffic aggregation."""

        # Biến tổng hợp thống kê lưu lượng theo từng phút
        last_traffic_log_time = time.time()
        safe_count_buffer = 0
        violator_count_buffer = 0
        counted_safe_ids = set()
        traffic_coll = db_collection.database[setting.TRAFFIC_STATS_COLLECTION]

        try:
            while self.is_running:
                # Nếu camera đang mất kết nối hoặc chưa có frame, chờ đợi và xóa ảnh đệm
                if not self.is_connected or self.raw_frame is None:
                    self.latest_frame = None  # Đảm bảo không còn ảnh cũ từ camera trước đó
                    await asyncio.sleep(0.1)
                    continue

                # Copy frame để capture thread có thể tiếp tục thay raw_frame trong lúc
                # YOLO xử lý frame hiện tại.
                frame = self.raw_frame.copy()

                # Chạy AI Inference
                # Tối ưu: Nếu là RTSP (delay cao), dùng imgsz nhỏ hơn để tăng tốc
                cam_info = self._get_camera_info()
                current_imgsz = setting.RTSP_INFERENCE_SIZE if self._is_rtsp_source(cam_info) else setting.VIDEO_INFERENCE_SIZE

                results = await run_in_threadpool(
                    model.track,
                    frame,
                    persist=True,
                    tracker=str(self.tracker_config_path),
                    imgsz=current_imgsz,
                    conf=setting.VIOLATION_THRESHOLD,
                    iou=0.5,
                    verbose=False,
                    device=setting.INFERENCE_DEVICE,
                    half=setting.INFERENCE_HALF,
                )
                # logger.debug("Tracker IDs: %s", results[0].boxes.id)

                annotated_frame, latest_all_detections, _ = annotated_helmet_frame(frame, results)

                # Encode frame đã vẽ annotation một lần, tất cả client streaming sẽ
                # dùng chung bytes này.
                ret, buffer = cv2.imencode(".jpg", annotated_frame)
                if ret:
                    self.latest_frame = buffer.tobytes()

                # AI FPS đo tốc độ detect + track, tách riêng Capture FPS vì đọc
                # camera và chạy model có thể nghẽn ở hai chỗ khác nhau.
                self.ai_frame_count += 1
                elapsed_time = time.time() - self.ai_fps_start_time
                if elapsed_time >= 1.0:  # Mỗi giây cập nhật một lần
                    self.ai_fps = round(self.ai_frame_count / elapsed_time, 1)
                    self.ai_frame_count = 0
                    self.ai_fps_start_time = time.time()

                # Logic voting xác nhận vi phạm:
                # Mặc định chỉ xác nhận bằng track_id vì nó bám theo một object cụ thể,
                # ít false positive hơn bbox voting trong cảnh đông người.
                confirmed_violators = []
                
                for det in latest_all_detections:
                    if det.class_id != 1:
                        continue
                    t_id = det.track_id
                    confirmed_by_track = False

                    if t_id is not None:
                        # 1. Lưu lịch sử class của ID này (tối đa 8 frame gần nhất)
                        if t_id not in self.track_history:
                            self.track_history[t_id] = deque(maxlen=8)
                        self.track_history[t_id].append(det.class_id)

                        # 2. Chỉ xác nhận nếu ID này chưa từng được log trong phiên hiện tại
                        if t_id not in self.logged_ids:
                            history = list(self.track_history[t_id])
                            confirmed_by_track = len(history) >= 3 and (history.count(1) / len(history)) >= 0.6

                    confirmed_by_bbox = False
                    if setting.ENABLE_SPATIAL_VOTING:
                        # Fallback này chỉ nên bật khi test thực tế cho thấy ByteTrack đổi ID
                        # liên tục khiến track voting không bao giờ đủ lịch sử.
                        confirmed_by_bbox = self._has_stable_spatial_violation(det, time.time())

                    if confirmed_by_track or confirmed_by_bbox:
                        if t_id is None or t_id not in self.logged_ids:
                            confirmed_violators.append(det)
                            if t_id is not None:
                                self.logged_ids.add(t_id)

                is_demo_source = cam_info.get("source_type") == CameraSourceType.VIDEO_FILE.value
                can_log_violation = True
                if is_demo_source:
                    # Video demo bị loop liên tục, nên cùng một cảnh có thể xuất hiện
                    # mãi mãi. Cooldown ngăn sample video spam violation vào MongoDB.
                    now = time.time()
                    cooldown = setting.DEMO_VIOLATION_COOLDOWN_SECONDS
                    can_log_violation = (now - self.demo_last_violation_log_time) >= cooldown

                if confirmed_violators and can_log_violation:
                    # Lọc thêm theo bbox gần đây để tránh log trùng khi tracker đổi ID
                    # nhưng người trong khung hình vẫn là cùng một người.
                    now = time.time()
                    camera_code = self.current_source_id
                    unique_violators = []
                    for det in confirmed_violators:
                        if self._is_duplicate_recent_violation(det, camera_code, now):
                            continue
                        self._remember_recent_violation(det, camera_code, now)
                        unique_violators.append(det)
                    confirmed_violators = unique_violators

                if confirmed_violators and can_log_violation:
                    # Chỉ tăng thống kê sau khi đã qua cooldown/dedup để traffic_stats không cao hơn
                    # số violation thực sự được ghi.
                    violator_count_buffer += len(confirmed_violators)

                    if is_demo_source:
                        self.demo_last_violation_log_time = time.time()
                    # Lưu violation ở task nền để việc ghi ảnh/DB không làm khựng
                    # live stream. camera_context là snapshot vì admin có thể đổi
                    # tên/vị trí camera sau khi violation đã được ghi.
                    asyncio.create_task(
                        save_violation_backtask(
                            annotated_frame.copy(),
                            len(confirmed_violators),
                            confirmed_violators,
                            db_collection,
                            camera_context={
                                "camera_id": cam_info.get("id"),
                                "camera_code": self.current_source_id,
                                "camera_name": cam_info.get("name"),
                                "camera_location": cam_info.get("location"),
                                "camera_source_type": cam_info.get("source_type"),
                                "is_demo": is_demo_source,
                            },
                        )
                    )

                # Tổng hợp traffic stats
                current_ids = {d.track_id for d in latest_all_detections if d.track_id is not None}

                # Xác định người an toàn: Đã rời khỏi khung hình, từng xuất hiện >= 3 frame, và không vi phạm
                lost_ids = set(self.track_history.keys()) - current_ids
                for tid in list(lost_ids):
                    if tid not in self.logged_ids and tid not in counted_safe_ids:
                        if len(self.track_history[tid]) >= 3:
                            counted_safe_ids.add(tid)
                            safe_count_buffer += 1

                    # ID đã rời khỏi khung hình thì bỏ khỏi track_history để không bị đếm lại
                    # ở phút thống kê sau.
                    self.track_history.pop(tid, None)

                # Dọn dẹp track_history để tránh phình RAM khi stream chạy lâu.
                # Chỉ giữ lại ID đang còn xuất hiện trên màn hình.
                if len(self.track_history) > 100:
                    self.track_history = {
                        tid: hist
                        for tid, hist in self.track_history.items()
                        if tid in current_ids
                    }

                # Gửi traffic stats lên DB mỗi 60 giây. Demo source không ghi vào
                # analytics thật để tránh làm bẩn số liệu vận hành.
                current_time = time.time()
                if current_time - last_traffic_log_time >= 60.0:
                    if (safe_count_buffer > 0 or violator_count_buffer > 0) and not is_demo_source:
                        traffic_doc = {
                            "timestamp": datetime.now(),
                            "safe_count": safe_count_buffer,
                            "violation_count": violator_count_buffer
                        }
                        asyncio.ensure_future(traffic_coll.insert_one(traffic_doc))
                        
                    safe_count_buffer = 0
                    violator_count_buffer = 0
                    counted_safe_ids.clear()  # Reset mỗi phút để giải phóng RAM
                    last_traffic_log_time = current_time

                await asyncio.sleep(0.001)
        except asyncio.CancelledError:
            logger.info("_inference_loop cancelled.")
        except Exception as e:
            logger.error(f"Inference error: {e}")
        finally:
            # Flush lần cuối khi pipeline dừng, nhưng vẫn bỏ qua demo source
            final_cam_info = self._get_camera_info()
            if (safe_count_buffer > 0 or violator_count_buffer > 0) and final_cam_info.get("source_type") != CameraSourceType.VIDEO_FILE.value:
                try:
                    traffic_doc = {
                        "timestamp": datetime.now(),
                        "safe_count": safe_count_buffer,
                        "violation_count": violator_count_buffer
                    }
                    # Flush cuối cần await để không mất thống kê khi inference task đang dừng.
                    await traffic_coll.insert_one(traffic_doc)
                    logger.info(f"Flushed final traffic stats before exit: {traffic_doc}")
                except Exception as e:
                    logger.error(f"Failed to flush final traffic stats: {e}")

    async def _telemetry_heartbeat(self):
        """Send telemetry regularly, even while AI or camera capture is waiting."""
        try:
            while self.is_running:
                try:
                    cam_info = self._get_camera_info()
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
# Singleton dùng chung cho toàn bộ app
# ──────────────────────────────────────────────────────────────────────────────

global_camera = GlobalCamera()


async def generated_video_frames(model, db_collection, viewer_id: str):
    """
    Yield MJPEG frames for a client.
    The background pipeline updates telemetry and logs violations when detected.
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
    API stop signal for a specific viewer.
    """
    # Xóa frame ngay lập tức để tránh hiện frame cuối bị đóng băng
    global_camera.latest_frame = None
    
    logger.info(f"API Stop request received for v_id={viewer_id}")

    # FE tạo stream id theo dạng "<viewer gốc>_<streamKey>" để tránh stream cũ
    # dọn nhầm stream mới khi switch camera. Khi user bấm tắt cam, cần dọn toàn bộ
    # stream id cùng viewer gốc, nếu không phần cứng sẽ vẫn chạy vì còn orphan viewer.
    viewer_prefix = viewer_id.rsplit("_", 1)[0] + "_" if "_" in viewer_id else viewer_id
    viewer_ids_to_stop = [
        active_id
        for active_id in list(global_camera.active_viewers)
        if active_id == viewer_id or active_id.startswith(viewer_prefix)
    ]
    if not viewer_ids_to_stop:
        viewer_ids_to_stop = [viewer_id]

    # Xóa viewer khỏi danh sách ngay lập tức. Nếu là người cuối cùng, stop hardware sẽ chạy.
    for active_id in viewer_ids_to_stop:
        await global_camera.stop(active_id)

    # Nếu sau khi xóa mà không còn ai xem, set cancel event
    if len(global_camera.active_viewers) == 0:
        if global_camera._session_cancel_event:
            global_camera._session_cancel_event.set()
        logger.info("ACTION: No active viewers remaining. Hardware shutdown signaled.")
    else:
        logger.info(f"ACTION: {len(global_camera.active_viewers)} viewers remaining. Hardware remains ON.")
