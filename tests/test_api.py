"""
IBVAP — Unit tests for FastAPI REST Endpoints & WebSocket
=========================================================
Tests health check, GET/POST events, stats, camera operations, fence config, and WebSocket streaming.

Run:
    python -m pytest tests/test_api.py -v
"""

from __future__ import annotations

import os
import shutil
import tempfile
import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.db.database import get_db, init_db


@pytest.fixture
def temp_api_db():
    tmp_dir = tempfile.mkdtemp()
    db_path = os.path.join(tmp_dir, "test_api_ibvap.db")

    # Import inside fixture to run event loop async init
    import asyncio
    asyncio.run(init_db(db_path))

    async def _override_get_db():
        from src.db.database import get_db_connection
        db = await get_db_connection(db_path)
        try:
            yield db
        finally:
            await db.close()

    app.dependency_overrides[get_db] = _override_get_db
    yield db_path
    app.dependency_overrides.clear()
    shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.fixture
def client(temp_api_db):
    return TestClient(app)


def test_root_and_health(client):
    res_root = client.get("/")
    assert res_root.status_code == 200
    # Root can return HTML (when SPA frontend is built) or JSON
    if "text/html" in res_root.headers.get("content-type", ""):
        assert "<html" in res_root.text.lower()
    else:
        assert res_root.json()["status"] == "online"

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"



def test_events_crud_and_stats(client):
    # Post event
    payload = {
        "timestamp": "2026-09-02T13:00:00Z",
        "event_type": "intrusion",
        "severity": "high",
        "camera_id": "cam_01",
        "track_id": 5,
        "class_name": "person",
        "zone_name": "restricted_area_1",
    }
    res_post = client.post("/api/events", json=payload)
    assert res_post.status_code == 201
    event_data = res_post.json()
    assert event_data["id"] is not None
    event_id = event_data["id"]

    # Get list
    res_list = client.get("/api/events")
    assert res_list.status_code == 200
    data = res_list.json()
    assert data["total"] >= 1
    assert data["items"][0]["id"] == event_id

    # Get single by id
    res_single = client.get(f"/api/events/{event_id}")
    assert res_single.status_code == 200
    assert res_single.json()["event_type"] == "intrusion"

    # Get stats
    res_stats = client.get("/api/events/stats")
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats["total_events"] >= 1
    assert stats["by_type"]["intrusion"] >= 1


def test_cameras_api(client):
    res_get = client.get("/api/cameras")
    assert res_get.status_code == 200
    cams = res_get.json()
    assert len(cams) >= 1

    payload = {
        "id": "cam_test",
        "name": "Test Camera",
        "source": "data/videos/test.mp4",
        "status": "active",
    }
    res_post = client.post("/api/cameras", json=payload)
    assert res_post.status_code == 201
    assert res_post.json()["id"] == "cam_test"


def test_config_fence_api(client):
    res_get = client.get("/api/config/fence")
    assert res_get.status_code == 200

    payload = {
        "cooldown_seconds": 20.0,
        "zones": [
            {
                "name": "test_zone",
                "polygon": [[0, 0], [100, 0], [100, 100], [0, 100]],
                "severity": "critical",
            }
        ],
    }
    res_post = client.post("/api/config/fence", json=payload)
    assert res_post.status_code == 200
    res_json = res_post.json()
    assert res_json["status"] == "success"
    assert res_json["config"]["cooldown_seconds"] == 20.0


def test_websocket_stream(client):
    with client.websocket_connect("/api/events/stream") as websocket:
        # Trigger event creation via REST
        client.post(
            "/api/events",
            json={
                "timestamp": "2026-09-02T13:05:00Z",
                "event_type": "face_unknown",
                "severity": "high",
                "camera_id": "cam_01",
            },
        )
        msg = websocket.receive_json()
        assert msg["type"] == "NEW_EVENT"
        assert msg["data"]["event_type"] == "face_unknown"


def test_simulate_event_api(client):
    res = client.post("/api/events/simulate")
    assert res.status_code == 201
    data = res.json()
    assert data["id"] is not None
    assert data["event_type"] in ["intrusion", "loitering", "face_match", "anpr"]
    assert data["confidence"] is not None


def test_faces_crud_api(client):
    # 1. List faces (initially empty)
    res_list = client.get("/api/faces")
    assert res_list.status_code == 200
    assert isinstance(res_list.json(), list)

    # 2. Upload face
    import io
    fake_img = io.BytesIO(b"fake image bytes")
    files = {"image": ("test_person.jpg", fake_img, "image/jpeg")}
    data = {"name": "Major Sandeep"}

    res_post = client.post("/api/faces", data=data, files=files)
    assert res_post.status_code == 201
    face = res_post.json()
    assert face["name"] == "Major Sandeep"
    face_id = face["id"]

    # 3. List faces again
    res_list_after = client.get("/api/faces")
    assert res_list_after.status_code == 200
    names = [f["name"] for f in res_list_after.json()]
    assert "Major Sandeep" in names

    # 4. Delete face
    res_del = client.delete(f"/api/faces/{face_id}")
    assert res_del.status_code == 200
    assert res_del.json()["status"] == "success"


def test_process_webcam_frame_api(client):
    import base64
    import numpy as np
    import cv2

    # Create dummy black frame
    dummy_img = np.zeros((240, 320, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", dummy_img)
    b64_str = "data:image/jpeg;base64," + base64.b64encode(buf).decode("utf-8")

    res = client.post(
        "/api/video/process-frame",
        json={"image": b64_str, "camera_id": "webcam_test", "frame_index": 1},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["camera_id"] == "webcam_test"
    assert "tracked_objects" in data
    assert "events_triggered" in data


def test_video_upload_api(client):
    import io
    import numpy as np
    import cv2
    import tempfile

    # Create small valid test video in temp file
    tmp_vid = os.path.join(tempfile.gettempdir(), "test_short.mp4")
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(tmp_vid, fourcc, 10.0, (320, 240))
    for _ in range(5):
        frame = np.zeros((240, 320, 3), dtype=np.uint8)
        out.write(frame)
    out.release()

    with open(tmp_vid, "rb") as f:
        vid_bytes = f.read()

    files = {"file": ("test_video.mp4", io.BytesIO(vid_bytes), "video/mp4")}
    data = {"camera_id": "upload_test_cam", "frame_skip": "1"}

    res = client.post("/api/video/upload", data=data, files=files)
    assert res.status_code == 200
    res_json = res.json()
    assert res_json["status"] == "completed"
    assert res_json["total_frames"] >= 5
    assert res_json["camera_id"] == "upload_test_cam"

    if os.path.exists(tmp_vid):
        os.remove(tmp_vid)


