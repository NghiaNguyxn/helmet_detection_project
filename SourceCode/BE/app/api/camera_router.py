from fastapi import APIRouter, Depends, Query, Request, status

from SourceCode.BE.app.dependencies.sql_database import SessionDep
from SourceCode.BE.app.dependencies.user import allow_admin
from SourceCode.BE.app.models.user import UserDB
from SourceCode.BE.app.schemas.base_schema import BaseResponse
from SourceCode.BE.app.schemas.camera_schema import CameraConnectionTestResponse, CameraCreate, CameraResponse, CameraUpdate
from SourceCode.BE.app.services import audit_service, camera_service
from SourceCode.BE.app.services.video_service import global_camera
from SourceCode.BE.app.utils import time as time_utils

router = APIRouter(prefix="/cameras", tags=["Cameras"])


@router.get("/", response_model=BaseResponse[list[CameraResponse]], dependencies=[Depends(allow_admin)])
async def read_cameras(
    session: SessionDep,
    include_deleted: bool = Query(False),
):
    cameras = camera_service.list_cameras(session, include_deleted=include_deleted)
    return BaseResponse(code=status.HTTP_200_OK, result=cameras)


@router.get("/demo-videos", response_model=BaseResponse[list[dict]], dependencies=[Depends(allow_admin)])
async def read_demo_videos():
    """List demo video files that can be used as camera sources."""

    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Demo videos retrieved successfully",
        result=camera_service.list_demo_videos(),
    )


@router.post("/", response_model=BaseResponse[CameraResponse], status_code=status.HTTP_201_CREATED)
async def create_camera(
    camera_in: CameraCreate,
    session: SessionDep,
    request: Request,
    admin_user: UserDB = Depends(allow_admin),
):
    camera = camera_service.create_camera(session, camera_in)
    audit_service.create_log(
        session=session,
        action="camera.created",
        actor=admin_user,
        target_type="camera",
        target_id=camera.id,
        description=f"Created camera {camera.code}",
        ip_address=audit_service.request_ip(request),
        metadata=camera_service.camera_snapshot(camera),
    )
    global_camera.reload_sources()

    return BaseResponse(
        code=status.HTTP_201_CREATED,
        message="Camera created successfully",
        result=camera,
    )


@router.patch("/{camera_id}", response_model=BaseResponse[CameraResponse])
async def update_camera(
    camera_id: int,
    camera_in: CameraUpdate,
    session: SessionDep,
    request: Request,
    admin_user: UserDB = Depends(allow_admin),
):
    old_camera = camera_service.get_camera(session, camera_id)
    old_snapshot = camera_service.camera_snapshot(old_camera) if old_camera else None
    camera = camera_service.update_camera(session, camera_id, camera_in)
    new_snapshot = camera_service.camera_snapshot(camera)
    changes = _snapshot_changes(old_snapshot, new_snapshot)
    audit_service.create_log(
        session=session,
        action="camera.updated",
        actor=admin_user,
        target_type="camera",
        target_id=camera.id,
        description=f"Updated camera {camera.code}",
        ip_address=audit_service.request_ip(request),
        metadata={"changed_fields": list(changes.keys()), "changes": changes},
    )
    global_camera.reload_sources()

    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Camera updated successfully",
        result=camera,
    )


@router.patch("/{camera_id}/status", response_model=BaseResponse[CameraResponse])
async def update_camera_status(
    camera_id: int,
    is_active: bool,
    session: SessionDep,
    request: Request,
    admin_user: UserDB = Depends(allow_admin),
):
    old_camera = camera_service.get_camera(session, camera_id)
    old_active = old_camera.is_active if old_camera else None
    old_code = old_camera.code if old_camera else str(camera_id)
    camera = camera_service.set_camera_active(session, camera_id, is_active)
    forced_stop = await _force_stop_if_current_disabled(camera)

    audit_service.create_log(
        session=session,
        action="camera.status_changed",
        actor=admin_user,
        target_type="camera",
        target_id=camera.id,
        description=f"Changed camera {camera.code} status",
        ip_address=audit_service.request_ip(request),
        metadata={
            "old_is_active": old_active,
            "new_is_active": camera.is_active,
            "forced_stop": forced_stop,
            "code": old_code,
        },
    )
    global_camera.reload_sources()

    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Camera status updated successfully",
        result=camera,
    )


@router.post("/{camera_id}/test", response_model=BaseResponse[CameraConnectionTestResponse])
async def test_camera(
    camera_id: int,
    session: SessionDep,
    request: Request,
    admin_user: UserDB = Depends(allow_admin),
):
    camera, message = camera_service.test_camera_connection(session, camera_id)
    audit_service.create_log(
        session=session,
        action="camera.tested",
        actor=admin_user,
        target_type="camera",
        target_id=camera.id,
        description=f"Tested camera {camera.code}: {camera.last_status}",
        ip_address=audit_service.request_ip(request),
        metadata={
            "code": camera.code,
            "last_status": camera.last_status,
            "last_checked_at": camera.last_checked_at.isoformat() if camera.last_checked_at else None,
            "message": message,
        },
    )
    global_camera.reload_sources()

    return BaseResponse(
        code=status.HTTP_200_OK,
        message=message,
        result=CameraConnectionTestResponse(
            camera_id=camera.id,
            code=camera.code,
            status=camera.last_status,
            message=message,
            checked_at=camera.last_checked_at or time_utils.utc_now(),
        ),
    )


@router.delete("/{camera_id}", response_model=BaseResponse[CameraResponse])
async def delete_camera(
    camera_id: int,
    session: SessionDep,
    request: Request,
    admin_user: UserDB = Depends(allow_admin),
):
    old_camera = camera_service.get_camera(session, camera_id)
    old_snapshot = camera_service.camera_snapshot(old_camera) if old_camera else None
    camera = camera_service.soft_delete_camera(session, camera_id)
    forced_stop = await _force_stop_if_current_disabled(camera)
    audit_service.create_log(
        session=session,
        action="camera.deleted",
        actor=admin_user,
        target_type="camera",
        target_id=camera.id,
        description=f"Soft deleted camera {camera.code}",
        ip_address=audit_service.request_ip(request),
        metadata={
            "camera": old_snapshot,
            "forced_stop": forced_stop,
        },
    )
    global_camera.reload_sources()

    return BaseResponse(
        code=status.HTTP_200_OK,
        message="Camera deleted successfully",
        result=camera,
    )


async def _force_stop_if_current_disabled(camera) -> bool:
    if camera.code == global_camera.current_source_id and (not camera.is_active or camera.is_deleted):
        await global_camera.force_stop_pipeline()
        return True
    return False


def _snapshot_changes(old_snapshot: dict | None, new_snapshot: dict) -> dict:
    if not old_snapshot:
        return {}
    changes = {}
    for key, old_value in old_snapshot.items():
        new_value = new_snapshot.get(key)
        if old_value != new_value:
            changes[key] = {"old": old_value, "new": new_value}
    return changes
