"""
IBVAP — Unit tests for the VirtualFence module
=================================================
Tests point-in-polygon logic, intrusion detection, debouncing/cooldown,
multi-zone handling, and drawing.

Run:
    python -m pytest tests/test_virtual_fence.py -v
"""

from __future__ import annotations

import numpy as np
import pytest

from src.rules.virtual_fence import VirtualFence, FenceZone, FenceEvent


# ── Mock tracked object ─────────────────────────────────────────────────────
# Mimics the interface of TrackedObject without importing the tracker module,
# so these tests are self-contained and don't require YOLO.


class _MockTrackedObject:
    """Lightweight stand-in for TrackedObject (avoids YOLO dependency)."""

    def __init__(
        self,
        track_id: int,
        center: tuple[int, int],
        class_name: str = "person",
        confidence: float = 0.9,
        bbox_xyxy: tuple[int, int, int, int] = (0, 0, 50, 50),
    ) -> None:
        self.track_id = track_id
        self._center = center
        self.class_name = class_name
        self.confidence = confidence
        self.bbox_xyxy = bbox_xyxy

    @property
    def center(self) -> tuple[int, int]:
        return self._center


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def square_zone_config() -> list[dict]:
    """A single 200×200 square zone at (100,100)→(300,300)."""
    return [
        {
            "name": "restricted_area_1",
            "polygon": [[100, 100], [300, 100], [300, 300], [100, 300]],
            "severity": "high",
        },
    ]


@pytest.fixture
def multi_zone_config() -> list[dict]:
    """Two non-overlapping zones."""
    return [
        {
            "name": "zone_a",
            "polygon": [[0, 0], [100, 0], [100, 100], [0, 100]],
            "severity": "high",
        },
        {
            "name": "zone_b",
            "polygon": [[200, 200], [400, 200], [400, 400], [200, 400]],
            "severity": "critical",
        },
    ]


# ── FenceZone dataclass tests ───────────────────────────────────────────────

class TestFenceZone:
    """Test the FenceZone dataclass."""

    def test_zone_creation(self) -> None:
        zone = FenceZone(
            name="test",
            polygon=[[0, 0], [100, 0], [100, 100], [0, 100]],
            severity="high",
        )
        assert zone.name == "test"
        assert zone.severity == "high"
        assert len(zone.polygon) == 4

    def test_default_severity(self) -> None:
        zone = FenceZone(name="test", polygon=[[0, 0], [10, 0], [10, 10]])
        assert zone.severity == "high"

    def test_np_polygon_shape(self) -> None:
        zone = FenceZone(name="test", polygon=[[0, 0], [100, 0], [100, 100], [0, 100]])
        np_poly = zone.np_polygon
        assert isinstance(np_poly, np.ndarray)
        assert np_poly.shape == (4, 2)
        assert np_poly.dtype == np.int32


# ── Point-in-polygon tests ──────────────────────────────────────────────────

class TestPointInPolygon:
    """Test the is_inside static method."""

    def test_point_inside_square(self) -> None:
        polygon = [[100, 100], [300, 100], [300, 300], [100, 300]]
        assert VirtualFence.is_inside((200, 200), polygon) is True

    def test_point_outside_square(self) -> None:
        polygon = [[100, 100], [300, 100], [300, 300], [100, 300]]
        assert VirtualFence.is_inside((50, 50), polygon) is False

    def test_point_on_edge(self) -> None:
        polygon = [[100, 100], [300, 100], [300, 300], [100, 300]]
        # Points on the edge should be considered inside (>= 0)
        assert VirtualFence.is_inside((100, 100), polygon) is True

    def test_point_in_triangle(self) -> None:
        polygon = [[0, 0], [200, 0], [100, 200]]
        assert VirtualFence.is_inside((100, 50), polygon) is True
        assert VirtualFence.is_inside((300, 300), polygon) is False

    def test_point_with_numpy_polygon(self) -> None:
        polygon = np.array([[0, 0], [100, 0], [100, 100], [0, 100]], dtype=np.int32)
        assert VirtualFence.is_inside((50, 50), polygon) is True
        assert VirtualFence.is_inside((150, 150), polygon) is False


# ── Intrusion detection tests ───────────────────────────────────────────────

class TestVirtualFenceCheck:
    """Test intrusion detection and debouncing logic."""

    def test_intrusion_detected(self, square_zone_config: list[dict]) -> None:
        """Object inside zone should trigger an event."""
        fence = VirtualFence(square_zone_config, cooldown_seconds=5.0)
        obj = _MockTrackedObject(track_id=1, center=(200, 200))

        events = fence.check([obj], timestamp=100.0)

        assert len(events) == 1
        assert events[0].zone_name == "restricted_area_1"
        assert events[0].track_id == 1
        assert events[0].severity == "high"
        assert events[0].class_name == "person"

    def test_no_intrusion_outside(self, square_zone_config: list[dict]) -> None:
        """Object outside zone should not trigger any event."""
        fence = VirtualFence(square_zone_config, cooldown_seconds=5.0)
        obj = _MockTrackedObject(track_id=1, center=(50, 50))

        events = fence.check([obj], timestamp=100.0)
        assert len(events) == 0

    def test_debounce_blocks_duplicate(self, square_zone_config: list[dict]) -> None:
        """Same track+zone within cooldown should not re-alert."""
        fence = VirtualFence(square_zone_config, cooldown_seconds=30.0)
        obj = _MockTrackedObject(track_id=1, center=(200, 200))

        events1 = fence.check([obj], timestamp=100.0)
        assert len(events1) == 1

        # 5 seconds later — within cooldown window
        events2 = fence.check([obj], timestamp=105.0)
        assert len(events2) == 0

    def test_debounce_allows_after_cooldown(self, square_zone_config: list[dict]) -> None:
        """Same track+zone after cooldown expires should re-alert."""
        fence = VirtualFence(square_zone_config, cooldown_seconds=10.0)
        obj = _MockTrackedObject(track_id=1, center=(200, 200))

        events1 = fence.check([obj], timestamp=100.0)
        assert len(events1) == 1

        # 15 seconds later — past cooldown
        events2 = fence.check([obj], timestamp=115.0)
        assert len(events2) == 1

    def test_different_tracks_alert_independently(self, square_zone_config: list[dict]) -> None:
        """Different track IDs in the same zone should both trigger."""
        fence = VirtualFence(square_zone_config, cooldown_seconds=30.0)
        obj1 = _MockTrackedObject(track_id=1, center=(200, 200))
        obj2 = _MockTrackedObject(track_id=2, center=(200, 200))

        events = fence.check([obj1, obj2], timestamp=100.0)
        assert len(events) == 2

        track_ids = {e.track_id for e in events}
        assert track_ids == {1, 2}

    def test_multi_zone_detection(self, multi_zone_config: list[dict]) -> None:
        """Objects in different zones should each trigger their zone's alert."""
        fence = VirtualFence(multi_zone_config, cooldown_seconds=5.0)
        obj_a = _MockTrackedObject(track_id=1, center=(50, 50))
        obj_b = _MockTrackedObject(track_id=2, center=(300, 300))

        events = fence.check([obj_a, obj_b], timestamp=100.0)

        assert len(events) == 2
        zone_names = {e.zone_name for e in events}
        assert "zone_a" in zone_names
        assert "zone_b" in zone_names

        # Verify severity carried through correctly
        for e in events:
            if e.zone_name == "zone_b":
                assert e.severity == "critical"

    def test_reset_clears_cooldowns(self, square_zone_config: list[dict]) -> None:
        """reset() should clear cooldown state, allowing immediate re-alert."""
        fence = VirtualFence(square_zone_config, cooldown_seconds=30.0)
        obj = _MockTrackedObject(track_id=1, center=(200, 200))

        fence.check([obj], timestamp=100.0)
        fence.reset()

        # Within old cooldown window, but reset was called
        events = fence.check([obj], timestamp=101.0)
        assert len(events) == 1

    def test_empty_objects_list(self, square_zone_config: list[dict]) -> None:
        """No objects should produce no events."""
        fence = VirtualFence(square_zone_config)
        events = fence.check([], timestamp=100.0)
        assert len(events) == 0

    def test_empty_zones(self) -> None:
        """No zones should produce no events even with objects."""
        fence = VirtualFence([], cooldown_seconds=5.0)
        obj = _MockTrackedObject(track_id=1, center=(200, 200))
        events = fence.check([obj], timestamp=100.0)
        assert len(events) == 0

    def test_fence_event_fields(self, square_zone_config: list[dict]) -> None:
        """FenceEvent should carry all expected fields."""
        fence = VirtualFence(square_zone_config, cooldown_seconds=5.0)
        obj = _MockTrackedObject(
            track_id=5, center=(200, 200), class_name="car",
            confidence=0.85, bbox_xyxy=(180, 180, 220, 220),
        )

        events = fence.check([obj], timestamp=42.0)
        assert len(events) == 1

        e = events[0]
        assert e.track_id == 5
        assert e.zone_name == "restricted_area_1"
        assert e.severity == "high"
        assert e.timestamp == 42.0
        assert e.class_name == "car"
        assert e.confidence == 0.85
        assert e.bbox_xyxy == (180, 180, 220, 220)
        assert e.center == (200, 200)


# ── Drawing tests ────────────────────────────────────────────────────────────

class TestDrawZones:
    """Test the zone drawing utility."""

    def test_draw_returns_copy(self) -> None:
        """draw_zones should not mutate the original frame."""
        frame = np.zeros((500, 500, 3), dtype=np.uint8)
        zones = [FenceZone(
            name="test",
            polygon=[[10, 10], [100, 10], [100, 100], [10, 100]],
            severity="high",
        )]
        annotated = VirtualFence.draw_zones(frame, zones)
        assert annotated is not frame

    def test_draw_with_empty_zones(self) -> None:
        """Drawing with no zones should return a new frame."""
        frame = np.ones((500, 500, 3), dtype=np.uint8) * 128
        annotated = VirtualFence.draw_zones(frame, [])
        assert annotated is not frame

    def test_draw_all_severities(self) -> None:
        """All severity levels should render without errors."""
        frame = np.zeros((500, 500, 3), dtype=np.uint8)
        zones = [
            FenceZone(name="z1", polygon=[[10, 10], [50, 10], [50, 50], [10, 50]], severity="low"),
            FenceZone(name="z2", polygon=[[60, 60], [100, 60], [100, 100], [60, 100]], severity="medium"),
            FenceZone(name="z3", polygon=[[110, 110], [150, 110], [150, 150], [110, 150]], severity="high"),
            FenceZone(name="z4", polygon=[[160, 160], [200, 160], [200, 200], [160, 200]], severity="critical"),
        ]
        annotated = VirtualFence.draw_zones(frame, zones)
        assert annotated.shape == frame.shape
