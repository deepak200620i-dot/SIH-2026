"""
IBVAP — Camera Management Routes
================================
GET and POST endpoints for camera sources.
"""

from __future__ import annotations

import aiosqlite
from fastapi import APIRouter, Depends

from src.api.models import CameraCreate, CameraResponse
from src.db.crud import add_camera, get_cameras
from src.db.database import get_db

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


@router.get("", response_model=list[CameraResponse])
async def list_cameras(
    db: aiosqlite.Connection = Depends(get_db),
) -> list[CameraResponse]:
    """List all registered camera sources."""
    cams = await get_cameras(db)
    return [CameraResponse(**c) for c in cams]


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
