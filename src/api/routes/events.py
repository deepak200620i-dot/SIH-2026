"""
IBVAP — Event Routes & Real-time WebSocket Stream
=================================================
REST endpoints for querying events, fetching statistics, creating events,
and a WebSocket connection for real-time live event streaming to the dashboard.
"""

from __future__ import annotations

import json
from typing import Any, Optional

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect

from src.api.models import EventCreate, EventListResponse, EventResponse, StatsResponse
from src.db.crud import create_event, get_event_by_id, get_events, get_stats
from src.db.database import get_db
from src.rules.event_engine import Event

router = APIRouter(prefix="/api/events", tags=["events"])


class ConnectionManager:
    """Manages active WebSocket connections for live event streaming."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Broadcast event JSON payload to all active WebSocket clients."""
        disconnected: list[WebSocket] = []
        payload = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(connection)


ws_manager = ConnectionManager()


@router.get("", response_model=EventListResponse)
async def list_events(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    severity: Optional[str] = Query(None, description="Filter by severity level"),
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    db: aiosqlite.Connection = Depends(get_db),
) -> EventListResponse:
    """List paginated events with optional type, severity, and camera filters."""
    items, total = await get_events(
        db,
        limit=limit,
        offset=offset,
        event_type=event_type,
        severity=severity,
        camera_id=camera_id,
    )
    return EventListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/stats", response_model=StatsResponse)
async def fetch_stats(
    db: aiosqlite.Connection = Depends(get_db),
) -> StatsResponse:
    """Get system-wide event and camera summary statistics."""
    stats = await get_stats(db)
    return StatsResponse(**stats)


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int,
    db: aiosqlite.Connection = Depends(get_db),
) -> EventResponse:
    """Fetch details of a single event by ID."""
    event_dict = await get_event_by_id(db, event_id)
    if not event_dict:
        raise HTTPException(status_code=404, detail="Event not found")
    return EventResponse(**event_dict)


@router.post("", response_model=EventResponse, status_code=201)
async def post_event(
    payload: EventCreate,
    db: aiosqlite.Connection = Depends(get_db),
) -> EventResponse:
    """Create a new event manually and broadcast it via WebSocket."""
    event_obj = Event(**payload.model_dump())
    created = await create_event(db, event_obj)
    event_dict = created.to_dict()

    # Broadcast to WebSocket subscribers
    await ws_manager.broadcast({"type": "NEW_EVENT", "data": event_dict})

    return EventResponse(**event_dict)


@router.post("/simulate", response_model=EventResponse, status_code=201)
async def simulate_event(
    db: aiosqlite.Connection = Depends(get_db),
) -> EventResponse:
    """Generate a realistic simulated security event and broadcast via WebSocket."""
    import datetime
    import random

    scenarios = [
        {
            "event_type": "intrusion",
            "severity": "critical",
            "class_name": "person",
            "zone_name": "perimeter_zone",
            "confidence": 0.94,
            "bbox": [420, 210, 580, 680],
            "metadata": {"zone_type": "border_fence", "simulated": True},
        },
        {
            "event_type": "loitering",
            "severity": "high",
            "class_name": "person",
            "zone_name": "restricted_area_1",
            "confidence": 0.88,
            "bbox": [250, 180, 390, 560],
            "metadata": {"dwell_time_seconds": 65.4, "simulated": True},
        },
        {
            "event_type": "face_match",
            "severity": "medium",
            "class_name": "person",
            "face_name": "john_doe",
            "confidence": 0.92,
            "bbox": [310, 140, 420, 280],
            "metadata": {"match_type": "known_personnel", "simulated": True},
        },
        {
            "event_type": "anpr",
            "severity": "medium",
            "class_name": "car",
            "plate_text": "DL01AB1234",
            "confidence": 0.96,
            "bbox": [550, 320, 920, 610],
            "metadata": {"country": "IND", "simulated": True},
        },
    ]

    choice = random.choice(scenarios)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    event_obj = Event(
        timestamp=now_iso,
        event_type=choice["event_type"],
        severity=choice["severity"],
        camera_id="cam_01",
        track_id=random.randint(10, 99),
        class_name=choice.get("class_name"),
        zone_name=choice.get("zone_name"),
        face_name=choice.get("face_name"),
        plate_text=choice.get("plate_text"),
        confidence=choice.get("confidence"),
        bbox=choice.get("bbox"),
        metadata=choice.get("metadata"),
    )

    created = await create_event(db, event_obj)
    event_dict = created.to_dict()

    await ws_manager.broadcast({"type": "NEW_EVENT", "data": event_dict})
    return EventResponse(**event_dict)


@router.delete("", response_model=dict[str, Any])
async def clear_all_events(
    db: aiosqlite.Connection = Depends(get_db),
) -> dict[str, Any]:
    """Clear all events from the database."""
    await db.execute("DELETE FROM events")
    await db.commit()
    await ws_manager.broadcast({"type": "EVENTS_CLEARED", "data": {}})
    return {"status": "success", "message": "All events cleared"}





@router.websocket("/stream")
async def websocket_event_stream(websocket: WebSocket) -> None:
    """WebSocket endpoint pushing real-time events to connected clients."""
    await ws_manager.connect(websocket)
    try:
        # Keep connection open until client disconnects
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
