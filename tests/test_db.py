"""
IBVAP — Unit tests for SQLite Database & CRUD
==============================================
Tests schema creation, event insertion, querying with filters, stats aggregation, and camera management.

Run:
    python -m pytest tests/test_db.py -v
"""

from __future__ import annotations

import os
import shutil
import tempfile
import pytest

from src.db.crud import (
    add_camera,
    create_event,
    get_cameras,
    get_event_by_id,
    get_events,
    get_stats,
)
from src.db.database import get_db_connection, init_db
from src.rules.event_engine import Event


@pytest.fixture
def temp_db_path():
    tmp_dir = tempfile.mkdtemp()
    db_path = os.path.join(tmp_dir, "test_ibvap.db")
    yield db_path
    shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_init_db(temp_db_path):
    await init_db(temp_db_path)
    assert os.path.exists(temp_db_path)

    db = await get_db_connection(temp_db_path)
    try:
        cur = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in await cur.fetchall()]
        assert "events" in tables
        assert "cameras" in tables
        assert "known_faces" in tables
    finally:
        await db.close()


@pytest.mark.asyncio
async def test_create_and_get_event(temp_db_path):
    await init_db(temp_db_path)
    db = await get_db_connection(temp_db_path)

    try:
        event = Event(
            timestamp="2026-09-02T12:00:00Z",
            event_type="intrusion",
            severity="critical",
            camera_id="cam_01",
            track_id=10,
            class_name="person",
            zone_name="perimeter_zone",
            confidence=0.92,
            bbox=[10, 20, 100, 200],
            snapshot="data/evidence/test.jpg",
            metadata={"source": "test"},
        )

        created = await create_event(db, event)
        assert created.id is not None
        assert created.id > 0

        fetched = await get_event_by_id(db, created.id)
        assert fetched is not None
        assert fetched["event_type"] == "intrusion"
        assert fetched["severity"] == "critical"
        assert fetched["bbox"] == [10, 20, 100, 200]
        assert fetched["metadata"] == {"source": "test"}
    finally:
        await db.close()


@pytest.mark.asyncio
async def test_get_events_filtering_and_stats(temp_db_path):
    await init_db(temp_db_path)
    db = await get_db_connection(temp_db_path)

    try:
        # Create events of different types/severities
        e1 = Event(timestamp="2026-09-02T12:00:00Z", event_type="intrusion", severity="high")
        e2 = Event(timestamp="2026-09-02T12:01:00Z", event_type="face_match", severity="low")
        e3 = Event(timestamp="2026-09-02T12:02:00Z", event_type="intrusion", severity="critical")

        await create_event(db, e1)
        await create_event(db, e2)
        await create_event(db, e3)

        # Get all
        items, total = await get_events(db, limit=10, offset=0)
        assert total == 3
        assert len(items) == 3

        # Filter by type
        items_int, total_int = await get_events(db, event_type="intrusion")
        assert total_int == 2
        assert all(item["event_type"] == "intrusion" for item in items_int)

        # Filter by severity
        items_crit, total_crit = await get_events(db, severity="critical")
        assert total_crit == 1
        assert items_crit[0]["severity"] == "critical"

        # Stats
        stats = await get_stats(db)
        assert stats["total_events"] == 3
        assert stats["by_type"]["intrusion"] == 2
        assert stats["by_type"]["face_match"] == 1
        assert stats["by_severity"]["high"] == 1
        assert stats["by_severity"]["low"] == 1
        assert stats["by_severity"]["critical"] == 1
    finally:
        await db.close()


@pytest.mark.asyncio
async def test_cameras_crud(temp_db_path):
    await init_db(temp_db_path)
    db = await get_db_connection(temp_db_path)

    try:
        cams = await get_cameras(db)
        assert len(cams) >= 1
        assert cams[0]["id"] == "cam_01"

        new_cam = await add_camera(
            db, camera_id="cam_02", name="Gate Beta", source="data/videos/test2.mp4"
        )
        assert new_cam["id"] == "cam_02"
        assert new_cam["name"] == "Gate Beta"

        updated_cams = await get_cameras(db)
        assert len(updated_cams) >= 2
    finally:
        await db.close()
