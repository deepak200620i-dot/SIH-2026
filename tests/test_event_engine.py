"""
IBVAP — Unit tests for EventEngine
==================================
Tests severity calculation, cooldown debouncing, evidence snapshot saving, and Event processing.

Run:
    python -m pytest tests/test_event_engine.py -v
"""

from __future__ import annotations

import os
import shutil
import tempfile
import numpy as np
import pytest

from src.rules.event_engine import Event, EventEngine


@pytest.fixture
def temp_evidence_dir():
    """Create a temporary directory for evidence snapshot saving."""
    tmp_dir = tempfile.mkdtemp()
    yield tmp_dir
    shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.fixture
def engine(temp_evidence_dir):
    """Return EventEngine instance configured with temporary evidence path."""
    config = {
        "events": {
            "cooldown_seconds": 10.0,
            "evidence_path": temp_evidence_dir,
        }
    }
    return EventEngine(config)


def test_severity_calculation(engine):
    # Intrusion severity
    assert engine.calculate_severity("intrusion", zone_severity="critical") == "critical"
    assert engine.calculate_severity("intrusion", zone_severity="high") == "high"
    assert engine.calculate_severity("intrusion", zone_severity="medium") == "medium"
    assert engine.calculate_severity("intrusion") == "high"

    # Face unknown severity
    assert engine.calculate_severity("face_unknown") == "high"

    # Face match severity (known vs unknown)
    assert engine.calculate_severity("face_match", is_known=True) == "low"
    assert engine.calculate_severity("face_match", is_known=False) == "high"

    # ANPR severity
    assert engine.calculate_severity("anpr") == "medium"

    # Loitering severity
    assert engine.calculate_severity("loitering") == "high"


def test_should_process_cooldown(engine):
    track_id = 1
    event_type = "intrusion"
    zone_name = "zone_1"

    # First event should pass
    assert engine.should_process(track_id, event_type, zone_name, timestamp=100.0) is True

    # Immediate duplicate event within 10s cooldown should fail
    assert engine.should_process(track_id, event_type, zone_name, timestamp=105.0) is False

    # Different event type or different zone should pass
    assert engine.should_process(track_id, "loitering", zone_name, timestamp=105.0) is True
    assert engine.should_process(track_id, event_type, "zone_2", timestamp=105.0) is True

    # After cooldown elapsed (100 + 10 = 110s), event should pass
    assert engine.should_process(track_id, event_type, zone_name, timestamp=111.0) is True


def test_reset_cooldown(engine):
    track_id = 1
    event_type = "intrusion"
    zone_name = "zone_1"

    assert engine.should_process(track_id, event_type, zone_name, timestamp=100.0) is True
    assert engine.should_process(track_id, event_type, zone_name, timestamp=105.0) is False

    engine.reset()

    # After reset, event should pass even at timestamp 105
    assert engine.should_process(track_id, event_type, zone_name, timestamp=105.0) is True


def test_save_snapshot(engine, temp_evidence_dir):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    bbox = [50, 50, 200, 200]

    path = engine.save_snapshot(frame, "intrusion", bbox=bbox, label="INTRUSION (person)")
    assert path is not None
    assert os.path.exists(path)
    assert temp_evidence_dir in path or os.path.basename(path).endswith(".jpg")


def test_process_event_full(engine, temp_evidence_dir):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    event = engine.process_event(
        event_type="intrusion",
        track_id=42,
        class_name="person",
        zone_name="restricted_area_1",
        zone_severity="high",
        confidence=0.89,
        bbox=[100, 100, 250, 300],
        frame=frame,
        camera_id="cam_01",
        timestamp_sec=100.0,
    )

    assert event is not None
    assert isinstance(event, Event)
    assert event.event_type == "intrusion"
    assert event.severity == "high"
    assert event.track_id == 42
    assert event.camera_id == "cam_01"
    assert event.snapshot is not None
    assert os.path.exists(event.snapshot)
