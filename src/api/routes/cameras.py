"""
IBVAP — Camera Management Routes
================================
GET and POST endpoints for camera sources.
"""

from __future__ import annotations

import aiosqlite
import cv2
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from src.api.models import CameraCreate, CameraResponse
from src.db.crud import add_camera, get_cameras
from src.db.database import get_db

router = APIRouter(prefix="/api/cameras", tags=["cameras"])

# Keeping one capture open per editor camera lets sequential preview requests
# advance through recorded video and avoids reconnecting to an RTSP source.
_preview_captures: dict[str, cv2.VideoCapture] = {}


@router.get("", response_model=list[CameraResponse])
async def list_cameras(
    db: aiosqlite.Connection = Depends(get_db),
) -> list[CameraResponse]:
    """List all registered camera sources."""
    cams = await get_cameras(db)
    return [CameraResponse(**c) for c in cams]


@router.get("/{camera_id}/preview", response_class=Response)
async def get_camera_preview(
    camera_id: str,
    db: aiosqlite.Connection = Depends(get_db),
) -> Response:
    """Return a current JPEG frame for the zone editor camera background."""
    cameras = await get_cameras(db)
    camera = next((item for item in cameras if item["id"] == camera_id), None)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")

    capture = _preview_captures.get(camera_id)
    if capture is None or not capture.isOpened():
        if capture is not None:
            capture.release()
        capture = cv2.VideoCapture(camera["source"])
        _preview_captures[camera_id] = capture

    ok, frame = capture.read()
    if not ok or frame is None:
        # Recorded files can reach EOF while an operator is editing. Restart
        # them; RTSP sources are reopened on the next request.
        capture.release()
        _preview_captures.pop(camera_id, None)
        capture = cv2.VideoCapture(camera["source"])
        _preview_captures[camera_id] = capture
        ok, frame = capture.read()
        if not ok or frame is None:
            capture.release()
            _preview_captures.pop(camera_id, None)
            raise HTTPException(status_code=503, detail="Camera feed is unavailable")

    height, width = frame.shape[:2]
    if (width, height) != (640, 360):
        frame = cv2.resize(frame, (640, 360), interpolation=cv2.INTER_AREA)
    ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
    if not ok:
        raise HTTPException(status_code=500, detail="Could not encode camera preview")
    return Response(
        content=encoded.tobytes(),
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@router.post("", response_model=CameraResponse, status_code=201)
async def create_or_update_camera(
    payload: CameraCreate,
    db: aiosqlite.Connection = Depends(get_db),
) -> CameraResponse:
    """Add a new camera or update an existing camera configuration."""
    cam = await add_camera(
        db,
        camera_id=payload.id,
        name=payload.name,
        source=payload.source,
        status=payload.status,
    )
    return CameraResponse(**cam)
