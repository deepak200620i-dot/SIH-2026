"""
IBVAP — CRUD Operations (PostgreSQL / asyncpg)
================================================
All SQL queries use PostgreSQL ``$1`` parameter placeholders.
Returns plain ``dict`` objects from ``asyncpg.Record``.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional


# ───────────────────────── helpers ──────────────────────────────────────
def _rec(row) -> dict[str, Any]:
    """Convert an asyncpg.Record to a plain dict."""
    if row is None:
        return {}
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
        bbox_json,
        snapshot,
        meta_json,
        status,
        evidence_sha256,
        integrity_status,
    )
    return _rec(row)


async def get_events(
    conn,
    *,
    limit: int = 20,
    offset: int = 0,
    event_type: Optional[str] = None,
    event_types: Optional[list[str] | str] = None,
    severity: Optional[str] = None,
    camera_id: Optional[str] = None,
) -> dict[str, Any]:
    """Fetch paginated events with optional filters. Returns {items, total}."""
    conditions: list[str] = []
    params: list[Any] = []
    idx = 1

    # Support single event_type or multiple event_types (comma-separated or list)
    types_list: list[str] = []
    if event_types:
        if isinstance(event_types, list):
            types_list = [t.strip() for t in event_types if t.strip()]
        elif isinstance(event_types, str):
            types_list = [t.strip() for t in event_types.split(",") if t.strip()]
    elif event_type:
        types_list = [t.strip() for t in event_type.split(",") if t.strip()]

    if types_list:
        if len(types_list) == 1:
            conditions.append(f"event_type = ${idx}")
            params.append(types_list[0])
            idx += 1
        else:
            conditions.append(f"event_type = ANY(${idx}::varchar[])")
            params.append(types_list)
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
    total = (await conn.fetchval("SELECT COUNT(*) FROM events")) or 0
    active_cameras = (
        await conn.fetchval(
            "SELECT COUNT(*) FROM cameras WHERE LOWER(status) IN ('active', 'online')"
        )
    ) or 0
    return {
        "total": total,
        "total_events": total,
        "active_cameras": active_cameras,
        "by_type": by_type,
        "by_severity": by_severity,
    }


async def get_analytics_data(conn, time_range: str = "24h") -> dict[str, Any]:
    """
    Aggregate analytics across the specified time range:
    '24h', '7d', '30d', '1y', 'all'.
    Returns {
        alertsTrend, intrusionsByCamera, unknownFacesTrend,
        vehicleDetections, personDetections, eventDistribution, cameraActivity
    }
    """
    range_clean = (time_range or "24h").lower()

    if range_clean == "7d":
        where_time = "WHERE timestamp >= NOW() - INTERVAL '7 days'"
        trunc = "day"
        date_fmt = "YYYY-MM-DD"
    elif range_clean == "30d":
        where_time = "WHERE timestamp >= NOW() - INTERVAL '30 days'"
        trunc = "day"
        date_fmt = "YYYY-MM-DD"
    elif range_clean == "1y":
        where_time = "WHERE timestamp >= NOW() - INTERVAL '1 year'"
        trunc = "month"
        date_fmt = "YYYY-MM"
    elif range_clean == "all":
        where_time = ""
        trunc = "day"
        date_fmt = "YYYY-MM-DD"
    else:  # default 24h
        where_time = "WHERE timestamp >= NOW() - INTERVAL '24 hours'"
        trunc = "hour"
        date_fmt = "HH24:00"

    # 1. Overall Alerts Trend
    trend_query = f"""
        SELECT to_char(date_trunc('{trunc}', timestamp), '{date_fmt}') as label,
               date_trunc('{trunc}', timestamp) as bucket,
               COUNT(*) as count
        FROM events
        {where_time}
        GROUP BY bucket, label
        ORDER BY bucket ASC
    """
    trend_rows = await conn.fetch(trend_query)
    alerts_trend = [{"timestamp": r["label"], "count": int(r["count"])} for r in trend_rows]

    # 2. Unknown Faces Trend
    where_face = f"{where_time} AND event_type = 'face_unknown'" if where_time else "WHERE event_type = 'face_unknown'"
    face_query = f"""
        SELECT to_char(date_trunc('{trunc}', timestamp), '{date_fmt}') as label,
               date_trunc('{trunc}', timestamp) as bucket,
               COUNT(*) as count
        FROM events
        {where_face}
        GROUP BY bucket, label
        ORDER BY bucket ASC
    """
    face_rows = await conn.fetch(face_query)
    unknown_faces_trend = [{"timestamp": r["label"], "count": int(r["count"])} for r in face_rows]

    # 3. Person Detections Trend
    where_person = f"{where_time} AND (event_type IN ('person_detected', 'face_match', 'face_unknown') OR class_name = 'person')" if where_time else "WHERE (event_type IN ('person_detected', 'face_match', 'face_unknown') OR class_name = 'person')"
    person_query = f"""
        SELECT to_char(date_trunc('{trunc}', timestamp), '{date_fmt}') as label,
               date_trunc('{trunc}', timestamp) as bucket,
               COUNT(*) as count
        FROM events
        {where_person}
        GROUP BY bucket, label
        ORDER BY bucket ASC
    """
    person_rows = await conn.fetch(person_query)
    person_detections = [{"timestamp": r["label"], "count": int(r["count"])} for r in person_rows]

    # 4. Vehicle / ANPR Detections Trend
    where_veh = f"{where_time} AND (event_type IN ('vehicle_detected', 'anpr') OR class_name IN ('car', 'truck', 'bus', 'motorcycle'))" if where_time else "WHERE (event_type IN ('vehicle_detected', 'anpr') OR class_name IN ('car', 'truck', 'bus', 'motorcycle'))"
    veh_query = f"""
        SELECT to_char(date_trunc('{trunc}', timestamp), '{date_fmt}') as label,
               date_trunc('{trunc}', timestamp) as bucket,
               COUNT(*) as count
        FROM events
        {where_veh}
        GROUP BY bucket, label
        ORDER BY bucket ASC
    """
    veh_rows = await conn.fetch(veh_query)
    vehicle_detections = [{"timestamp": r["label"], "count": int(r["count"])} for r in veh_rows]

    # 5. Intrusions by Camera
    where_intrusions = f"{where_time} AND event_type = 'intrusion'" if where_time else "WHERE event_type = 'intrusion'"
    cam_intrusions_query = f"""
        SELECT camera_id, COUNT(*) as count
        FROM events
        {where_intrusions}
        GROUP BY camera_id
        ORDER BY count DESC
    """
    cam_intrusions_rows = await conn.fetch(cam_intrusions_query)
    intrusions_by_camera = [{"camera": r["camera_id"] or "cam_01", "count": int(r["count"])} for r in cam_intrusions_rows]

    # 6. Camera Activity (all events by camera)
    cam_act_query = f"""
        SELECT camera_id, COUNT(*) as count
        FROM events
        {where_time}
        GROUP BY camera_id
        ORDER BY count DESC
    """
    cam_act_rows = await conn.fetch(cam_act_query)
    camera_activity = [{"camera": r["camera_id"] or "cam_01", "events": int(r["count"])} for r in cam_act_rows]

    # 7. Event Distribution by type
    type_query = f"""
        SELECT event_type, COUNT(*) as count
        FROM events
        {where_time}
        GROUP BY event_type
        ORDER BY count DESC
    """
    type_rows = await conn.fetch(type_query)
    type_map = {
        "intrusion": "INTRUSION",
        "loitering": "LOITERING",
        "face_match": "FACE_RECOGNIZED",
        "face_unknown": "UNKNOWN_FACE",
        "anpr": "ANPR_DETECTED",
        "weapon_detected": "WEAPON_DETECTED",
        "direction_violation": "DIRECTION_VIOLATION",
        "crowding": "CROWDING",
        "rapid_movement": "RAPID_MOVEMENT",
        "abnormal_dwell": "ABNORMAL_DWELL",
        "repeated_zone_entry": "REPEATED_ZONE_ENTRY",
        "person_detected": "PERSON_DETECTED",
        "vehicle_detected": "VEHICLE_DETECTED",
    }
    event_distribution = [
        {"type": type_map.get(r["event_type"], r["event_type"].upper()), "count": int(r["count"])}
        for r in type_rows
    ]

    return {
        "alertsTrend": alerts_trend,
        "intrusionsByCamera": intrusions_by_camera,
        "unknownFacesTrend": unknown_faces_trend,
        "vehicleDetections": vehicle_detections,
        "personDetections": person_detections,
        "eventDistribution": event_distribution,
        "cameraActivity": camera_activity,
    }


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
    else:
        d["image_url"] = None
    return d


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
            try:
                d["polygon"] = json.loads(d["polygon"])
            except Exception:
                pass
        if not d.get("camera_id"):
            d["camera_id"] = "all"
        if "updated_at" in d:
            d["created_at"] = d.pop("updated_at", None)
        results.append(d)
    return results


async def create_fence_zone(
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
        try:
            d["polygon"] = json.loads(d["polygon"])
        except Exception:
            pass
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
