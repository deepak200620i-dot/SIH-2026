"""
IBVAP — Camera Management Routes
================================
GET and POST endpoints for camera sources.
"""

from __future__ import annotations

import cv2
import numpy as np
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from src.api.models import CameraCreate, CameraResponse
from src.db.crud import add_camera, delete_camera, get_cameras
from src.db.database import get_db

router = APIRouter(prefix="/api/cameras", tags=["cameras"])

# Keeping one capture open per editor camera lets sequential preview requests
# advance through recorded video and avoids reconnecting to an RTSP source.
_preview_captures: dict[str, cv2.VideoCapture] = {}


def _generate_cctv_standby_frame(camera_id: str, camera_name: str) -> np.ndarray:
    """
    Generate a high-tech surveillance CCTV standby test card (640x360).
    Displayed when a physical video stream or RTSP feed is offline or pending.
    """
    w, h = 640, 360
    # Dark slate/navy security monitor background
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    frame[:] = (18, 14, 10)  # BGR

    # Subtle grid lines
    grid_color = (30, 24, 18)
    for x in range(0, w, 80):
        cv2.line(frame, (x, 0), (x, h), grid_color, 1)
    for y in range(0, h, 60):
        cv2.line(frame, (0, y), (w, y), grid_color, 1)

    # Subtle crosshairs at center
    cx, cy = w // 2, h // 2
    cv2.line(frame, (cx - 20, cy), (cx + 20, cy), (50, 42, 32), 1)
    cv2.line(frame, (cx, cy - 20), (cx, cy + 20), (50, 42, 32), 1)

    # Corner viewfinder brackets in cyan/teal
    hud_color = (210, 180, 40)  # BGR teal/cyan
    bracket_len = 24
    # Top-Left
    cv2.line(frame, (25, 25), (25 + bracket_len, 25), hud_color, 2)
    cv2.line(frame, (25, 25), (25, 25 + bracket_len), hud_color, 2)
    # Top-Right
    cv2.line(frame, (w - 25, 25), (w - 25 - bracket_len, 25), hud_color, 2)
    cv2.line(frame, (w - 25, 25), (w - 25, 25 + bracket_len), hud_color, 2)
    # Bottom-Left
    cv2.line(frame, (25, h - 25), (25 + bracket_len, h - 25), hud_color, 2)
    cv2.line(frame, (25, h - 25), (25, h - 25 - bracket_len), hud_color, 2)
    # Bottom-Right
    cv2.line(frame, (w - 25, h - 25), (w - 25 - bracket_len, h - 25), hud_color, 2)
    cv2.line(frame, (w - 25, h - 25), (w - 25, h - 25 - bracket_len), hud_color, 2)

    # Status indicator dot & banner
    cv2.circle(frame, (40, 42), 5, (0, 200, 120), -1)  # Green live status dot
    cv2.putText(frame, "CCTV STANDBY", (55, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 220, 140), 1, cv2.LINE_AA)

    # Camera Info top-right
    cam_label = f"[{camera_id.upper()}] {camera_name[:24]}"
    (lw, _), _ = cv2.getTextSize(cam_label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
    cv2.putText(frame, cam_label, (w - 35 - lw, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (190, 190, 190), 1, cv2.LINE_AA)

    # Center bounding reticle & message
    box_w, box_h = 320, 90
    bx1, by1 = cx - box_w // 2, cy - box_h // 2
    bx2, by2 = bx1 + box_w, by1 + box_h
    cv2.rectangle(frame, (bx1, by1), (bx2, by2), (45, 36, 28), -1)
    cv2.rectangle(frame, (bx1, by1), (bx2, by2), (75, 60, 48), 1)

    t1 = "FEED STANDBY / NO RTSP SIGNAL"
    (t1w, _), _ = cv2.getTextSize(t1, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
    cv2.putText(frame, t1, (cx - t1w // 2, cy - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (230, 230, 230), 1, cv2.LINE_AA)

    t2 = "ZONE EDITOR READY - CLICK TO DRAW"
    (t2w, _), _ = cv2.getTextSize(t2, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)
    cv2.putText(frame, t2, (cx - t2w // 2, cy + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (140, 140, 140), 1, cv2.LINE_AA)

    # Bottom telemetry bar
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    bar_text = f"RES: 640x360  |  FPS: --  |  TIME: {now_str}"
    cv2.putText(frame, bar_text, (35, h - 35), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (120, 120, 120), 1, cv2.LINE_AA)

    return frame


@router.get("", response_model=list[CameraResponse])
async def list_cameras(
    db=Depends(get_db),
) -> list[CameraResponse]:
    """List all registered camera sources."""
    cams = await get_cameras(db)
    return [CameraResponse(**c) for c in cams]


@router.get("/{camera_id}/preview", response_class=Response)
async def get_camera_preview(
    camera_id: str,
    db=Depends(get_db),
) -> Response:
    """Return a current JPEG frame for the zone editor camera background."""
    cameras = await get_cameras(db)
    camera = next((item for item in cameras if item["id"] == camera_id), None)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")

    source = camera["source"]
    src_val = int(source) if (isinstance(source, str) and source.isdigit()) else source
    frame = None

    capture = _preview_captures.get(camera_id)
    try:
        if capture is None or not capture.isOpened():
            if capture is not None:
                try:
                    capture.release()
                except Exception:
                    pass
            capture = cv2.VideoCapture(src_val)
            _preview_captures[camera_id] = capture

        ok, frame = capture.read()
        if not ok or frame is None:
            # Try rewinding video file if at EOF
            capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, frame = capture.read()
            if not ok or frame is None:
                frame = None
    except Exception:
        frame = None

    # If real video capture produced a frame, return it resized
    if frame is not None:
        height, width = frame.shape[:2]
        if (width, height) != (640, 360):
            frame = cv2.resize(frame, (640, 360), interpolation=cv2.INTER_AREA)
        ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
        if ok:
            return Response(
                content=encoded.tobytes(),
                media_type="image/jpeg",
                headers={"Cache-Control": "no-store, max-age=0"},
            )

    # Resilient fallback: Return authentic CCTV Standby frame instead of 503 error
    standby_frame = _generate_cctv_standby_frame(camera_id, camera.get("name", camera_id))
    ok, encoded = cv2.imencode(".jpg", standby_frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
    return Response(
        content=encoded.tobytes() if ok else b"",
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@router.post("", response_model=CameraResponse, status_code=201)
async def create_or_update_camera(
    payload: CameraCreate,
    db=Depends(get_db),
) -> CameraResponse:
    """Add a new camera or update an existing camera configuration."""
    cam = await add_camera(
        db,
        id=payload.id,
        name=payload.name,
        source=payload.source,
        status=payload.status,
    )
    return CameraResponse(**cam)


@router.delete("/{camera_id}")
async def remove_camera(camera_id: str, db=Depends(get_db)) -> dict[str, bool]:
    """Delete a camera configuration and release its preview capture."""
    capture = _preview_captures.pop(camera_id, None)
    if capture is not None:
        capture.release()
    if not await delete_camera(db, camera_id):
        raise HTTPException(status_code=404, detail="Camera not found")
    return {"success": True}
