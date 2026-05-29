from pathlib import Path

import cv2
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from SourceCode.BE.app.models.camera import CameraDB
from SourceCode.BE.app.schemas.camera_schema import CameraCreate, CameraUpdate
from SourceCode.BE.app.enums.camera_source_type import CameraSourceType
from SourceCode.BE.app.utils import time as time_utils


DEMO_VIDEO_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "demo"
DEMO_VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


def get_camera(session: Session, camera_id: int, include_deleted: bool = False) -> CameraDB | None:
    camera = session.get(CameraDB, camera_id)
    if camera and (include_deleted or not camera.is_deleted):
        return camera
    return None


def get_camera_by_code(session: Session, code: str, include_deleted: bool = False) -> CameraDB | None:
    statement = select(CameraDB).where(CameraDB.code == code)
    if not include_deleted:
        statement = statement.where(CameraDB.is_deleted == False)
    return session.exec(statement).first()


def list_cameras(session: Session, include_deleted: bool = False) -> list[CameraDB]:
    statement = select(CameraDB).order_by(CameraDB.code.asc())
    if not include_deleted:
        statement = statement.where(CameraDB.is_deleted == False)
    return session.exec(statement).all()


def list_active_cameras(session: Session) -> list[CameraDB]:
    statement = (
        select(CameraDB)
        .where(CameraDB.is_deleted == False, CameraDB.is_active == True)
        .order_by(CameraDB.code.asc())
    )
    return session.exec(statement).all()


def create_camera(session: Session, camera_in: CameraCreate) -> CameraDB:
    data = camera_in.model_dump()
    data["source_url"] = _normalize_source_url(data["source_type"], data["source_url"])
    db_camera = CameraDB(**data)
    session.add(db_camera)

    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Camera code already exists")
    except Exception:
        session.rollback()
        raise

    session.refresh(db_camera)
    return db_camera


def update_camera(session: Session, camera_id: int, camera_in: CameraUpdate) -> CameraDB:
    db_camera = get_camera(session, camera_id)
    if not db_camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    update_data = camera_in.model_dump(exclude_unset=True)
    source_type = update_data.get("source_type", db_camera.source_type)
    source_url = update_data.get("source_url")
    if source_url is not None:
        update_data["source_url"] = _normalize_source_url(source_type, source_url)
    db_camera.sqlmodel_update(update_data)
    session.add(db_camera)

    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Camera code already exists")
    except Exception:
        session.rollback()
        raise

    session.refresh(db_camera)
    return db_camera


def set_camera_active(session: Session, camera_id: int, is_active: bool) -> CameraDB:
    db_camera = get_camera(session, camera_id)
    if not db_camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    db_camera.is_active = is_active
    session.add(db_camera)

    try:
        session.commit()
    except Exception:
        session.rollback()
        raise

    session.refresh(db_camera)
    return db_camera


def soft_delete_camera(session: Session, camera_id: int) -> CameraDB:
    db_camera = get_camera(session, camera_id)
    if not db_camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    db_camera.is_deleted = True
    db_camera.is_active = False
    db_camera.deleted_at = time_utils.utc_now()
    session.add(db_camera)

    try:
        session.commit()
    except Exception:
        session.rollback()
        raise

    session.refresh(db_camera)
    return db_camera


def test_camera_connection(session: Session, camera_id: int) -> tuple[CameraDB, str]:
    db_camera = get_camera(session, camera_id)
    if not db_camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    checked_at = time_utils.utc_now()
    status_value = "offline"
    message = "Camera source could not be opened"

    cap = None
    try:
        source = _opencv_source(db_camera)
        if db_camera.source_type == CameraSourceType.RTSP:
            cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        else:
            cap = cv2.VideoCapture(source)

        if cap is not None and cap.isOpened():
            ok, _ = cap.read()
            if ok:
                status_value = "online"
                message = "Camera connection successful"
            else:
                message = "Camera opened but no frame was received"
    finally:
        if cap is not None:
            cap.release()

    db_camera.last_status = status_value
    db_camera.last_checked_at = checked_at
    session.add(db_camera)

    try:
        session.commit()
    except Exception:
        session.rollback()
        raise

    session.refresh(db_camera)
    return db_camera, message


def _opencv_source(camera: CameraDB):
    if camera.source_type == CameraSourceType.WEBCAM:
        try:
            return int(camera.source_url)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webcam source_url must be an integer index")
    if camera.source_type == CameraSourceType.VIDEO_FILE:
        return str(resolve_demo_video_path(camera.source_url))
    return camera.source_url


def list_demo_videos() -> list[dict]:
    DEMO_VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    videos = []
    for path in sorted(DEMO_VIDEO_DIR.iterdir()):
        if not path.is_file() or path.suffix.lower() not in DEMO_VIDEO_EXTENSIONS:
            continue
        videos.append(
            {
                "name": path.name,
                "source_url": path.name,
                "size_bytes": path.stat().st_size,
            }
        )
    return videos


def resolve_demo_video_path(source_url: str) -> Path:
    normalized = _normalize_demo_video_source(source_url)
    target_path = (DEMO_VIDEO_DIR / normalized).resolve()
    demo_root = DEMO_VIDEO_DIR.resolve()

    # Chặn path traversal và absolute path. Video demo chỉ được nằm trong static/demo.
    if not target_path.is_file() or demo_root not in target_path.parents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Demo video file not found")
    return target_path


def _normalize_source_url(source_type: CameraSourceType | str, source_url: str) -> str:
    source_type_value = source_type.value if hasattr(source_type, "value") else source_type
    cleaned = source_url.strip()

    if source_type_value == CameraSourceType.WEBCAM.value:
        if not cleaned.isdigit():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webcam source_url must be an integer index")
        return cleaned

    if source_type_value == CameraSourceType.VIDEO_FILE.value:
        return _normalize_demo_video_source(cleaned)

    return cleaned


def _normalize_demo_video_source(source_url: str) -> str:
    raw_path = Path(source_url.strip())
    if raw_path.is_absolute() or ".." in raw_path.parts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Demo video must be selected from static/demo")

    # Cho phép format cũ "demo/file.mp4", nhưng DB chỉ lưu tên file để resolve
    # luôn trỏ về SourceCode/BE/static/demo.
    parts = raw_path.parts
    if len(parts) == 2 and parts[0] == "demo":
        normalized = parts[1]
    elif len(parts) == 1:
        normalized = parts[0]
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Demo video must be selected from static/demo")

    if Path(normalized).suffix.lower() not in DEMO_VIDEO_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported demo video file type")

    return normalized


def camera_snapshot(camera: CameraDB) -> dict:
    return {
        "id": camera.id,
        "code": camera.code,
        "name": camera.name,
        "location": camera.location,
        "source_type": camera.source_type.value if hasattr(camera.source_type, "value") else camera.source_type,
        "source_url": camera.source_url,
        "is_active": camera.is_active,
        "last_status": camera.last_status,
        "is_deleted": camera.is_deleted,
    }
