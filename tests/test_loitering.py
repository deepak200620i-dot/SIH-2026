"""
IBVAP — Unit tests for LoiteringDetector
=========================================
Tests temporal dwell time calculation, loitering threshold alert triggering, and cooldown debouncing.

Run:
    python -m pytest tests/test_loitering.py -v
"""

from __future__ import annotations

import pytest
from src.rules.loitering import LoiteringDetector, LoiteringEvent


class _MockTrackedObject:
    def __init__(self, track_id: int, center: tuple[int, int], class_name: str = "person"):
        self.track_id = track_id
        self.center = center
        self.class_name = class_name
        self.confidence = 0.9
        self.bbox_xyxy = (center[0] - 20, center[1] - 20, center[0] + 20, center[1] + 20)


@pytest.fixture
def loitering_detector():
    zones = [
        {
            "name": "gate_zone",
            "polygon": [[0, 0], [200, 0], [200, 200], [0, 200]],
            "severity": "high",
        }
    ]
    return LoiteringDetector(zones=zones, threshold_seconds=30.0, cooldown_seconds=20.0)


def test_loitering_trigger_and_cooldown(loitering_detector):
    obj = _MockTrackedObject(track_id=1, center=(100, 100))

    # Entry at t=100s
    events_t100 = loitering_detector.check([obj], timestamp=100.0)
    assert len(events_t100) == 0
    assert loitering_detector.get_dwell_time(1, "gate_zone", 100.0) == 0.0

    # Dwell 20s at t=120s (below 30s threshold)
    events_t120 = loitering_detector.check([obj], timestamp=120.0)
    assert len(events_t120) == 0

    # Dwell 35s at t=135s (exceeds 30s threshold) -> Trigger alert
    events_t135 = loitering_detector.check([obj], timestamp=135.0)
    assert len(events_t135) == 1
    assert events_t135[0].track_id == 1
    assert events_t135[0].zone_name == "gate_zone"
    assert events_t135[0].dwell_time_seconds == 35.0

    # Dwell 40s at t=140s (within 20s cooldown) -> Suppressed
    events_t140 = loitering_detector.check([obj], timestamp=140.0)
    assert len(events_t140) == 0

    # Dwell 60s at t=160s (after 20s cooldown elapsed) -> Trigger second alert
    events_t160 = loitering_detector.check([obj], timestamp=160.0)
    assert len(events_t160) == 1


def test_object_leaving_zone_resets_dwell(loitering_detector):
    inside_obj = _MockTrackedObject(track_id=1, center=(100, 100))
    outside_obj = _MockTrackedObject(track_id=1, center=(300, 300))

    # Object enters at t=100s
    loitering_detector.check([inside_obj], timestamp=100.0)
    assert loitering_detector.get_dwell_time(1, "gate_zone", 120.0) == 20.0

    # Object leaves zone at t=121s
    loitering_detector.check([outside_obj], timestamp=121.0)
    assert loitering_detector.get_dwell_time(1, "gate_zone", 125.0) == 0.0
