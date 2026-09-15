"""
IBVAP — CRUD Operations (PostgreSQL / asyncpg)
================================================
All SQL queries use PostgreSQL ``$1`` parameter placeholders.
Returns plain ``dict`` objects from ``asyncpg.Record``.
"""

from __future__ import annotations

import json
<<<<<<< HEAD
import os
=======
from datetime import datetime, timezone
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
from typing import Any, Optional


<<<<<<< HEAD
from src.rules.event_engine import Event



def _row_to_dict(row: aiosqlite.Row) -> dict[str, Any]:
    """Convert sqlite row to dictionary and parse JSON fields."""
=======
# ───────────────────────── helpers ──────────────────────────────────────
def _rec(row) -> dict[str, Any]:
    """Convert an asyncpg.Record to a plain dict."""
    if row is None:
        return {}
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
    d = dict(row)
    # Stringify datetimes for JSON compatibility
    for k, v in d.items():
        if isinstance(v, datetime):
            d[k] = v.isoformat()
    # Deserialize JSON strings for Pydantic schema compatibility
    if isinstance(d.get("bbox"), str):
        try:
            d["bbox"] = json.loads(d["bbox"])
        except Exception:
            pass
    if isinstance(d.get("metadata"), str):
        try:
            d["metadata"] = json.loads(d["metadata"])
        except Exception:
            pass
    if isinstance(d.get("polygon"), str):
        try:
            d["polygon"] = json.loads(d["polygon"])
        except Exception:
            pass
    return d



<<<<<<< HEAD
    query = """
        INSERT INTO events (
            timestamp, event_type, severity, camera_id, track_id,
            class_name, zone_name, face_name, plate_text, confidence,
            bbox, snapshot, metadata, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
=======
# ───────────────────────── EVENTS ──────────────────────────────────────
async def create_event(
    conn,
    *,
    timestamp: str,
    event_type: str,
    severity: str,
    camera_id: str = "cam_01",
    track_id: Optional[int] = None,
    class_name: Optional[str] = None,
    zone_name: Optional[str] = None,
    face_name: Optional[str] = None,
    plate_text: Optional[str] = None,
    confidence: Optional[float] = None,
    bbox: Optional[Any] = None,
    snapshot: Optional[str] = None,
    metadata: Optional[dict] = None,
    status: str = "ACTIVE",
    evidence_sha256: Optional[str] = None,
    integrity_status: str = "PENDING",
) -> dict[str, Any]:
    """Insert a new event and return it with its generated ID."""
    bbox_json = json.dumps(bbox) if bbox is not None else None
    meta_json = json.dumps(metadata) if metadata is not None else None

    # Ensure datetime object for PostgreSQL TIMESTAMPTZ
    ts = timestamp
    if isinstance(ts, str):
        try:
            ts = datetime.fromisoformat(ts)
        except Exception:
            ts = datetime.now(timezone.utc)
    elif ts is None:
        ts = datetime.now(timezone.utc)

    row = await conn.fetchrow(
        """
        INSERT INTO events
            (timestamp, event_type, severity, camera_id, track_id,
             class_name, zone_name, face_name, plate_text, confidence,
             bbox, snapshot, metadata, status,
             evidence_sha256, integrity_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11::jsonb, $12, $13::jsonb, $14, $15, $16)
        RETURNING *
        """,
        ts,
        event_type,
        severity,
        camera_id,
        track_id,
        class_name,
        zone_name,
        face_name,
        plate_text,
        confidence,
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
        bbox_json,
        snapshot,
        meta_json,
<<<<<<< HEAD
        event.status,
=======
        status,
        evidence_sha256,
        integrity_status,
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
    )
    return _rec(row)


async def update_event_status(
    db: aiosqlite.Connection, event_id: int, status: str
) -> dict[str, Any] | None:
    """Persist an operator acknowledgement/investigation state for an event."""
    await db.execute("UPDATE events SET status = ? WHERE id = ?", (status, event_id))
    await db.commit()
    return await get_event_by_id(db, event_id)


async def get_events(
    conn,
    *,
    limit: int = 20,
    offset: int = 0,
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    camera_id: Optional[str] = None,
) -> dict[str, Any]:
    """Fetch paginated events with optional filters. Returns {items, total}."""
    conditions: list[str] = []
    params: list[Any] = []
    idx = 1

    if event_type:
        conditions.append(f"event_type = ${idx}")
        params.append(event_type)
        idx += 1
    if severity:
        conditions.append(f"severity = ${idx}")
        params.append(severity)
        idx += 1
    if camera_id:
        conditions.append(f"camera_id = ${idx}")
        params.append(camera_id)
        idx += 1

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # Total count
    count_q = f"SELECT COUNT(*) FROM events {where}"
    total = await conn.fetchval(count_q, *params)

    # Items
    items_q = f"""
        SELECT * FROM events {where}
        ORDER BY timestamp DESC
        LIMIT ${idx} OFFSET ${idx + 1}
    """
    params.extend([limit, offset])
    rows = await conn.fetch(items_q, *params)

<<<<<<< HEAD
    cur = await db.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,))
    row = await cur.fetchone()
    return dict(row)


async def get_known_faces(db: aiosqlite.Connection) -> list[dict[str, Any]]:
    """List all registered known faces."""
    cur = await db.execute("SELECT id, name, image_path, created_at FROM known_faces ORDER BY id DESC")
    rows = await cur.fetchall()
    results = []
    for row in rows:
        d = dict(row)
        img_path = d.get("image_path")
        # Format image URL for API response
        if img_path:
            relative_path = os.path.relpath(img_path, "data/faces").replace("\\", "/")
            d["image_url"] = f"/api/faces/images/{relative_path}"
        else:
            d["image_url"] = None
        results.append(d)
    return results


async def add_known_face(
    db: aiosqlite.Connection,
    name: str,
    image_path: Optional[str] = None,
    embedding: Optional[bytes] = None,
) -> dict[str, Any]:
    """Insert a new known face record."""
    cursor = await db.execute(
        "INSERT INTO known_faces (name, image_path, embedding) VALUES (?, ?, ?)",
        (name, image_path, embedding),
    )
    await db.commit()
    face_id = cursor.lastrowid

    cur = await db.execute("SELECT id, name, image_path, created_at FROM known_faces WHERE id = ?", (face_id,))
    row = await cur.fetchone()
    d = dict(row)
    if d.get("image_path"):
        relative_path = os.path.relpath(d["image_path"], "data/faces").replace("\\", "/")
        d["image_url"] = f"/api/faces/images/{relative_path}"
=======
    return {"items": [_rec(r) for r in rows], "total": total}


async def get_event(conn, event_id: int) -> Optional[dict[str, Any]]:
    """Fetch a single event by ID."""
    row = await conn.fetchrow("SELECT * FROM events WHERE id = $1", event_id)
    return _rec(row) if row else None


async def update_event_status(conn, event_id: int, status: str) -> bool:
    """Update the status of an event. Returns True if updated."""
    result = await conn.execute(
        "UPDATE events SET status = $1 WHERE id = $2", status, event_id
    )
    return result.endswith("1")


async def get_event_stats(conn) -> dict[str, Any]:
    """Aggregate event statistics by type and severity."""
    type_rows = await conn.fetch(
        "SELECT event_type, COUNT(*) AS cnt FROM events GROUP BY event_type"
    )
    sev_rows = await conn.fetch(
        "SELECT severity, COUNT(*) AS cnt FROM events GROUP BY severity"
    )
    by_type = {r["event_type"]: r["cnt"] for r in type_rows}
    by_severity = {r["severity"]: r["cnt"] for r in sev_rows}
    total = await conn.fetchval("SELECT COUNT(*) FROM events")
    return {"total": total, "by_type": by_type, "by_severity": by_severity}


async def update_event_integrity(
    conn, event_id: int, integrity_status: str, evidence_sha256: Optional[str] = None
) -> bool:
    """Update integrity fields for an event."""
    if evidence_sha256:
        result = await conn.execute(
            "UPDATE events SET integrity_status = $1, evidence_sha256 = $2 WHERE id = $3",
            integrity_status,
            evidence_sha256,
            event_id,
        )
    else:
        result = await conn.execute(
            "UPDATE events SET integrity_status = $1 WHERE id = $2",
            integrity_status,
            event_id,
        )
    return result.endswith("1")


async def update_event_ledger(
    conn, event_id: int, provider: str, record_id: str, status: str
) -> bool:
    """Update ledger registration fields for an event."""
    result = await conn.execute(
        """
        UPDATE events
        SET ledger_provider = $1, ledger_record_id = $2, ledger_status = $3
        WHERE id = $4
        """,
        provider,
        record_id,
        status,
        event_id,
    )
    return result.endswith("1")


# ───────────────────────── CAMERAS ─────────────────────────────────────
async def get_cameras(conn) -> list[dict[str, Any]]:
    rows = await conn.fetch("SELECT * FROM cameras ORDER BY id")
    return [_rec(r) for r in rows]


async def create_camera(
    conn, *, id: str, name: str, source: str, status: str = "active"
) -> dict[str, Any]:
    row = await conn.fetchrow(
        """
        INSERT INTO cameras (id, name, source, status)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET name = $2, source = $3, status = $4
        RETURNING *
        """,
        id,
        name,
        source,
        status,
    )
    return _rec(row)


async def delete_camera(conn, camera_id: str) -> bool:
    result = await conn.execute("DELETE FROM cameras WHERE id = $1", camera_id)
    return result.endswith("1")


# ───────────────────────── KNOWN FACES ─────────────────────────────────
async def get_known_faces(conn) -> list[dict[str, Any]]:
    rows = await conn.fetch("SELECT id, name, image_path, created_at FROM known_faces ORDER BY id")
    result = []
    for r in rows:
        d = _rec(r)
        if d.get("image_path"):
            norm = d["image_path"].replace("\\", "/").strip("/")
            for pfx in ("data/faces/", "data/evidence/", "data/"):
                if norm.startswith(pfx):
                    norm = norm[len(pfx):]
                    break
            d["image_url"] = f"/api/evidence/{norm}"
        else:
            d["image_url"] = None
        result.append(d)
    return result


async def add_known_face(
    conn, *, name: str, image_path: str, embedding: Optional[bytes] = None
) -> dict[str, Any]:
    row = await conn.fetchrow(
        """
        INSERT INTO known_faces (name, image_path, embedding)
        VALUES ($1, $2, $3)
        RETURNING *
        """,
        name,
        image_path,
        embedding,
    )
    d = _rec(row)
    if d.get("image_path"):
        norm = d["image_path"].replace("\\", "/").strip("/")
        for pfx in ("data/faces/", "data/evidence/", "data/"):
            if norm.startswith(pfx):
                norm = norm[len(pfx):]
                break
        d["image_url"] = f"/api/evidence/{norm}"
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
    else:
        d["image_url"] = None
    return d


<<<<<<< HEAD
async def delete_known_face(db: aiosqlite.Connection, face_id: int) -> bool:
    """Delete a known face record by ID."""
    cur = await db.execute("SELECT image_path FROM known_faces WHERE id = ?", (face_id,))
    row = await cur.fetchone()
    if not row:
        return False
    await db.execute("DELETE FROM known_faces WHERE id = ?", (face_id,))
    await db.commit()
    return True


async def get_fence_zones(
    db: aiosqlite.Connection,
    camera_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    """List all configured fence zones, optionally filtering by camera_id."""
    if camera_id and camera_id != "all":
        cur = await db.execute(
            "SELECT * FROM fence_zones WHERE camera_id = ? OR camera_id = 'all' ORDER BY id ASC",
            (camera_id,),
        )
    else:
        cur = await db.execute("SELECT * FROM fence_zones ORDER BY id ASC")
    rows = await cur.fetchall()
    results = []
    for row in rows:
        d = dict(row)
        if "polygon" in d and isinstance(d["polygon"], str):
=======
async def delete_known_face(conn, face_id: int) -> bool:
    result = await conn.execute("DELETE FROM known_faces WHERE id = $1", face_id)
    return result.endswith("1")


# ───────────────────────── FENCE ZONES ─────────────────────────────────
async def get_fence_zones(
    conn, camera_id: Optional[str] = None
) -> list[dict[str, Any]]:
    if camera_id:
        rows = await conn.fetch(
            """
            SELECT * FROM fence_zones
            WHERE camera_id = $1 OR camera_id = 'all'
            ORDER BY id
            """,
            camera_id,
        )
    else:
        rows = await conn.fetch("SELECT * FROM fence_zones ORDER BY id")

    results = []
    for r in rows:
        d = _rec(r)
        # polygon is already JSONB → Python list
        if d.get("polygon") and isinstance(d["polygon"], str):
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
            try:
                d["polygon"] = json.loads(d["polygon"])
            except Exception:
                pass
<<<<<<< HEAD
=======
        if not d.get("camera_id"):
            d["camera_id"] = "all"
        if "updated_at" in d:
            d["created_at"] = d.pop("updated_at", None)
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
        results.append(d)
    return results


async def create_fence_zone(
<<<<<<< HEAD
    db: aiosqlite.Connection,
    name: str,
    polygon: list[list[int]],
    severity: str = "high",
    camera_id: str = "all",
) -> dict[str, Any]:
    """Insert or update a fence zone."""
    poly_json = json.dumps(polygon)
    query = """
        INSERT INTO fence_zones (name, camera_id, polygon, severity)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
            camera_id=excluded.camera_id,
            polygon=excluded.polygon,
            severity=excluded.severity
    """
    cursor = await db.execute(query, (name, camera_id, poly_json, severity))
    await db.commit()

    cur = await db.execute("SELECT * FROM fence_zones WHERE name = ?", (name,))
    row = await cur.fetchone()
    d = dict(row)
    if "polygon" in d and isinstance(d["polygon"], str):
=======
    conn,
    *,
    name: str,
    polygon: list,
    severity: str = "high",
    camera_id: str = "all",
) -> dict[str, Any]:
    polygon_json = json.dumps(polygon)
    row = await conn.fetchrow(
        """
        INSERT INTO fence_zones (name, camera_id, polygon, severity)
        VALUES ($1, $2, $3::jsonb, $4)
        ON CONFLICT (name) DO UPDATE
            SET polygon = $3::jsonb, severity = $4, camera_id = $2,
                updated_at = NOW()
        RETURNING *
        """,
        name,
        camera_id,
        polygon_json,
        severity,
    )
    d = _rec(row)
    if d.get("polygon") and isinstance(d["polygon"], str):
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
        try:
            d["polygon"] = json.loads(d["polygon"])
        except Exception:
            pass
<<<<<<< HEAD
    return d


async def delete_fence_zone(db: aiosqlite.Connection, zone_id: int) -> bool:
    """Delete a fence zone by ID."""
    cur = await db.execute("SELECT id FROM fence_zones WHERE id = ?", (zone_id,))
    row = await cur.fetchone()
    if not row:
        return False
    await db.execute("DELETE FROM fence_zones WHERE id = ?", (zone_id,))
    await db.commit()
    return True
=======
    if "updated_at" in d:
        d["created_at"] = d.pop("updated_at", None)
    return d


async def delete_fence_zone(conn, zone_id: int) -> bool:
    result = await conn.execute("DELETE FROM fence_zones WHERE id = $1", zone_id)
    return result.endswith("1")


# ───────────────────────── USERS ───────────────────────────────────────
async def get_user_by_username(conn, username: str) -> Optional[dict[str, Any]]:
    row = await conn.fetchrow("SELECT * FROM users WHERE username = $1", username)
    return _rec(row) if row else None


async def create_user(
    conn, *, username: str, password_hash: str, role: str = "operator"
) -> dict[str, Any]:
    row = await conn.fetchrow(
        """
        INSERT INTO users (username, password_hash, role)
        VALUES ($1, $2, $3)
        RETURNING *
        """,
        username,
        password_hash,
        role,
    )
    return _rec(row)


async def get_users(conn) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        "SELECT id, username, role, is_active, created_at FROM users ORDER BY id"
    )
    return [_rec(r) for r in rows]


# ───────────────────────── ALIASES / COMPAT ────────────────────────────
# Aliases to preserve old import names used by route files
add_camera = create_camera
get_event_by_id = get_event
get_stats = get_event_stats


async def update_event_metadata(conn, event_id: int, updates: dict[str, Any]) -> bool:
    """Merge additional metadata fields into an existing event's metadata JSONB."""
    if not updates or not event_id:
        return False
    row = await conn.fetchrow("SELECT metadata FROM events WHERE id = $1", event_id)
    if row is None:
        return False
    existing = row["metadata"] or {}
    if isinstance(existing, str):
        try:
            existing = json.loads(existing)
        except Exception:
            existing = {}
    existing.update(updates)
    meta_json = json.dumps(existing)
    result = await conn.execute(
        "UPDATE events SET metadata = $1::jsonb WHERE id = $2",
        meta_json,
        event_id,
    )
    return result.endswith("1")
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
