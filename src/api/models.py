"""
IBVAP — Pydantic Schemas for API Requests & Responses
=====================================================
"""

from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


class EventBase(BaseModel):
    timestamp: str
    event_type: str = Field(..., description="intrusion, face_match, face_unknown, anpr, loitering")
    severity: str = Field(..., description="low, medium, high, critical")
    camera_id: str = "cam_01"
    track_id: Optional[int] = None
    class_name: Optional[str] = None
    zone_name: Optional[str] = None
    face_name: Optional[str] = None
    plate_text: Optional[str] = None
    confidence: Optional[float] = None
    bbox: Optional[list[float]] = None
    snapshot: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    status: str = "ACTIVE"


class EventCreate(EventBase):
    pass


class EventResponse(EventBase):
    id: int
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EventStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(ACTIVE|ACKNOWLEDGED|INVESTIGATING|RESOLVED)$")


class EventListResponse(BaseModel):
    items: list[EventResponse]
    total: int
    limit: int
    offset: int


class CameraBase(BaseModel):
    id: str
    name: str
    source: str
    status: str = "active"


class CameraCreate(CameraBase):
    pass


class CameraResponse(CameraBase):
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class StatsResponse(BaseModel):
    total_events: int
    active_cameras: int
    by_type: dict[str, int]
    by_severity: dict[str, int]


class FenceZoneSchema(BaseModel):
    name: str
    polygon: list[list[int]]
    severity: str = "high"


class FenceConfigUpdate(BaseModel):
    cooldown_seconds: Optional[float] = 30.0
    zones: list[FenceZoneSchema]


class ConfigResponse(BaseModel):
    status: str = "success"
    message: str
    config: dict[str, Any]


class KnownFaceResponse(BaseModel):
    id: int
    name: str
    image_url: Optional[str] = None
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
