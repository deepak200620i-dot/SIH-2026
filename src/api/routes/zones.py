"""
IBVAP — Restricted Zones API Routes
===================================
Endpoints for retrieving, defining, and deleting polygon restricted zones.
Synchronizes dynamically with the AI VideoPipeline virtual fence.
"""

from __future__ import annotations

from typing import Any, Optional
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.api.routes.video import get_pipeline
from src.db.crud import create_fence_zone, delete_fence_zone, get_fence_zones
from src.db.database import get_db

router = APIRouter(prefix="/api/zones", tags=["zones"])


class ZoneCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    polygon: list[list[int]] = Field(..., min_length=3)
    severity: str = Field("high", description="low, medium, high, or critical")
    camera_id: str = Field("all", description="camera_id or 'all'")


class ZoneResponse(BaseModel):
    id: int
    name: str
    camera_id: str
    polygon: list[list[int]]
    severity: str
    created_at: Optional[str] = None


@router.get("", response_model=list[ZoneResponse])
async def list_zones(
    camera_id: Optional[str] = None,
    db: aiosqlite.Connection = Depends(get_db),
) -> list[dict[str, Any]]:
    """Fetch all configured restricted zones."""
    return await get_fence_zones(db, camera_id=camera_id)


@router.post("", response_model=ZoneResponse)
async def add_or_update_zone(
    payload: ZoneCreateRequest,
    db: aiosqlite.Connection = Depends(get_db),
) -> dict[str, Any]:
    """Create or update a restricted polygon zone and reload active pipeline fence."""
    if len(payload.polygon) < 3:
        raise HTTPException(status_code=400, detail="Polygon must have at least 3 vertices")

    zone = await create_fence_zone(
        db=db,
        name=payload.name,
        polygon=payload.polygon,
        severity=payload.severity.lower(),
        camera_id=payload.camera_id,
    )

    # Sync with running pipeline
    try:
        pipeline = get_pipeline()
        all_zones = await get_fence_zones(db)
        pipeline.update_zones(all_zones)
    except Exception as e:
        print(f"Notice: could not sync pipeline zones immediately: {e}")

    return zone


@router.delete("/{zone_id}")
async def remove_zone(
    zone_id: int,
    db: aiosqlite.Connection = Depends(get_db),
) -> dict[str, bool]:
    """Delete a restricted zone and refresh active pipeline fence."""
    success = await delete_fence_zone(db, zone_id)
    if not success:
        raise HTTPException(status_code=404, detail="Zone not found")

    try:
        pipeline = get_pipeline()
        all_zones = await get_fence_zones(db)
        pipeline.update_zones(all_zones)
    except Exception as e:
        print(f"Notice: could not sync pipeline zones immediately: {e}")

    return {"success": True}
