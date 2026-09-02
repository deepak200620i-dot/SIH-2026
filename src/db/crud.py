"""
IBVAP — Database CRUD Operations
===============================
Async helper functions for creating and querying events, cameras, and known faces.
"""

from __future__ import annotations

import json
from typing import Any, Optional

import aiosqlite

from src.rules.event_engine import Event


def _row_to_dict(row: aiosqlite.Row) -> dict[str, Any]:
    """Convert sqlite row to dictionary and parse JSON fields."""
    d = dict(row)
    if "bbox" in d and d["bbox"]:
        try:
            d["bbox"] = json.loads(d["bbox"])
        except Exception:
            pass
    if "metadata" in d and d["metadata"]:
        try:
            d["metadata"] = json.loads(d["metadata"])
        except Exception:
            pass
    return d


async def create_event(db: aiosqlite.Connection, event: Event) -> Event:
    """Insert a new event into SQLite database."""
    bbox_json = json.dumps(event.bbox) if event.bbox is not None else None
    meta_json = json.dumps(event.metadata) if event.metadata is not None else None

    query = """
        INSERT INTO events (
            timestamp, event_type, severity, camera_id, track_id,
            class_name, zone_name, face_name, plate_text, confidence,
            bbox, snapshot, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    params = (
        event.timestamp,
        event.event_type,
        event.severity,
        event.camera_id,
        event.track_id,
        event.class_name,
        event.zone_name,
        event.face_name,
        event.plate_text,
        event.confidence,
        bbox_json,
        event.snapshot,
        meta_json,
    )

    cursor = await db.execute(query, params)
    await db.commit()
    event.id = cursor.lastrowid

    # Fetch created_at timestamp
    cur = await db.execute("SELECT created_at FROM events WHERE id = ?", (event.id,))
    row = await cur.fetchone()
    if row:
        event.created_at = row[0]

    return event


async def get_event_by_id(db: aiosqlite.Connection, event_id: int) -> dict[str, Any] | None:
    """Fetch single event by ID."""
    cur = await db.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    row = await cur.fetchone()
    if not row:
        return None
    return _row_to_dict(row)


async def get_events(
    db: aiosqlite.Connection,
    limit: int = 50,
    offset: int = 0,
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    camera_id: Optional[str] = None,
) -> tuple[list[dict[str, Any]], int]:
    """Fetch paginated, filterable events list and total matching count."""
    conditions: list[str] = []
    params: list[Any] = []

    if event_type:
        conditions.append("event_type = ?")
        params.append(event_type)
    if severity:
        conditions.append("severity = ?")
        params.append(severity)
    if camera_id:
        conditions.append("camera_id = ?")
        params.append(camera_id)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Count total
    count_query = f"SELECT COUNT(*) FROM events {where_clause}"
    cur_count = await db.execute(count_query, params)
    total = (await cur_count.fetchone())[0]

    # Select page items
    select_query = f"SELECT * FROM events {where_clause} ORDER BY id DESC LIMIT ? OFFSET ?"
    cur_select = await db.execute(select_query, params + [limit, offset])
    rows = await cur_select.fetchall()

    items = [_row_to_dict(row) for row in rows]
    return items, total


async def get_stats(db: aiosqlite.Connection) -> dict[str, Any]:
    """Get summary statistics for total events, breakdown by type, and breakdown by severity."""
    cur_total = await db.execute("SELECT COUNT(*) FROM events")
    total_events = (await cur_total.fetchone())[0]

    cur_type = await db.execute("SELECT event_type, COUNT(*) FROM events GROUP BY event_type")
    by_type = {row[0]: row[1] for row in await cur_type.fetchall()}

    cur_sev = await db.execute("SELECT severity, COUNT(*) FROM events GROUP BY severity")
    by_severity = {row[0]: row[1] for row in await cur_sev.fetchall()}

    cur_cams = await db.execute("SELECT COUNT(*) FROM cameras WHERE status = 'active'")
    active_cameras = (await cur_cams.fetchone())[0]

    return {
        "total_events": total_events,
        "active_cameras": active_cameras,
        "by_type": by_type,
        "by_severity": by_severity,
    }


async def get_cameras(db: aiosqlite.Connection) -> list[dict[str, Any]]:
    """List all configured cameras."""
    cur = await db.execute("SELECT * FROM cameras ORDER BY id ASC")
    rows = await cur.fetchall()
    return [dict(row) for row in rows]


async def add_camera(
    db: aiosqlite.Connection,
    camera_id: str,
    name: str,
    source: str,
    status: str = "active",
) -> dict[str, Any]:
    """Add or update a camera configuration."""
    query = """
        INSERT INTO cameras (id, name, source, status)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            source=excluded.source,
            status=excluded.status
    """
    await db.execute(query, (camera_id, name, source, status))
    await db.commit()

    cur = await db.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,))
    row = await cur.fetchone()
    return dict(row)
