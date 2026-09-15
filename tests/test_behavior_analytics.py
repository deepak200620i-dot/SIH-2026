"""
IBVAP — Trajectory-Based Behavior Analytics Unit Tests
======================================================
Tests rule-based anomaly detection:
- Direction violation
- Repeated entry
- Crowding
- Rapid movement
- Abnormal dwell

Run:
    python -m pytest tests/test_behavior_analytics.py -v
"""

from dataclasses import dataclass
import pytest

from src.rules.behavior_analytics import BehaviorAnalytics, BehaviorEvent


@dataclass
class MockTrackedObject:
    track_id: int
    center: tuple[float, float]
    class_name: str = "person"
    bbox_xyxy: list[float] = None
    confidence: float = 0.95

    def __post_init__(self):
        if self.bbox_xyxy is None:
            cx, cy = self.center
            self.bbox_xyxy = [cx - 20, cy - 40, cx + 20, cy + 40]


@pytest.fixture
def sample_zones():
    return [
        {
            "name": "zone_north",
            "polygon": [[100, 100], [400, 100], [400, 400], [100, 400]],
            "severity": "high",
        }
    ]


@pytest.fixture
def analytics_engine(sample_zones):
    config = {
        "behavior_analytics": {
            "direction_enabled": True,
            "min_displacement_px": 20,
            "angle_tolerance_deg": 30,
            "zone_permitted_directions": {"zone_north": 0},  # 0 deg = rightwards (+x)
            "repeated_entry_enabled": True,
            "max_entries": 2,
            "entry_window_minutes": 10,
            "crowding_enabled": True,
            "max_persons_per_zone": 2,
            "rapid_movement_enabled": True,
            "max_speed_px_per_sec": 100,
            "abnormal_dwell_enabled": True,
            "base_dwell_seconds": 10,
            "excessive_dwell_multiplier": 2.0,  # threshold = 20s
            "cooldown_seconds": 5.0,
        }
    }
    return BehaviorAnalytics(config, zones=sample_zones)


def test_direction_violation(analytics_engine):
    # Permitted direction for zone_north is 0 deg (eastward/right)
    # Moving downwards (-dy < 0, angle = 270 deg)
    t0 = 1000.0
    obj1 = MockTrackedObject(track_id=1, center=(200, 150))
    analytics_engine.analyze([obj1], frame_time=t0)

    # Frame 2: moved down by 50px (exceeds min_displacement_px=20)
    t1 = t0 + 1.0
    obj2 = MockTrackedObject(track_id=1, center=(200, 200))
    events = analytics_engine.analyze([obj2], frame_time=t1)

    dir_events = [e for e in events if e.event_type == "direction_violation"]
    assert len(dir_events) == 1
    assert dir_events[0].track_id == 1
    assert dir_events[0].zone_name == "zone_north"


def test_rapid_movement(analytics_engine):
    t0 = 1000.0
    obj1 = MockTrackedObject(track_id=5, center=(50, 50))
    analytics_engine.analyze([obj1], frame_time=t0)

    # Frame 2: 0.5 sec later, moved 150px -> speed = 300 px/sec > 100 max
    t1 = t0 + 0.5
    obj2 = MockTrackedObject(track_id=5, center=(200, 50))
    events = analytics_engine.analyze([obj2], frame_time=t1)

    rapid_events = [e for e in events if e.event_type == "rapid_movement"]
    assert len(rapid_events) == 1
    assert rapid_events[0].track_id == 5


def test_crowding(analytics_engine):
    # max_persons_per_zone = 2
    # Place 3 persons inside zone_north
    t0 = 1000.0
    objs = [
        MockTrackedObject(track_id=10, center=(200, 200)),
        MockTrackedObject(track_id=11, center=(250, 250)),
        MockTrackedObject(track_id=12, center=(300, 300)),
    ]
    events = analytics_engine.analyze(objs, frame_time=t0)

    crowd_events = [e for e in events if e.event_type == "crowding"]
    assert len(crowd_events) == 1
    assert crowd_events[0].zone_name == "zone_north"
    assert crowd_events[0].metadata["person_count"] == 3


def test_abnormal_dwell(analytics_engine):
    # threshold is 20s (10s base * 2.0 multiplier)
    t0 = 1000.0
    obj1 = MockTrackedObject(track_id=20, center=(50, 50))
    analytics_engine.analyze([obj1], frame_time=t0)

    # Frame 2: 25s later, still active
    t1 = t0 + 25.0
    obj2 = MockTrackedObject(track_id=20, center=(52, 52))
    events = analytics_engine.analyze([obj2], frame_time=t1)

    dwell_events = [e for e in events if e.event_type == "abnormal_dwell"]
    assert len(dwell_events) == 1
    assert dwell_events[0].track_id == 20


def test_repeated_entry(analytics_engine):
    # max_entries = 2
    # Entry 1: inside zone
    t0 = 1000.0
    obj_in = MockTrackedObject(track_id=30, center=(200, 200))
    obj_out = MockTrackedObject(track_id=30, center=(50, 50))

    analytics_engine.analyze([obj_in], frame_time=t0)  # entry 1
    analytics_engine.analyze([obj_out], frame_time=t0 + 1.0)  # exit

    analytics_engine.analyze([obj_in], frame_time=t0 + 10.0)  # entry 2
    analytics_engine.analyze([obj_out], frame_time=t0 + 11.0)  # exit

    # entry 3 -> exceeds max_entries (2)
    events = analytics_engine.analyze([obj_in], frame_time=t0 + 20.0)
    rep_events = [e for e in events if e.event_type == "repeated_zone_entry"]
    assert len(rep_events) == 1
    assert rep_events[0].track_id == 30
