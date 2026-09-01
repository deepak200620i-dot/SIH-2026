"""
IBVAP — Unit tests for the Tracker module
============================================
Tests that the Tracker loads, runs tracking, and produces correct output
with persistent track IDs.

Run:
    python -m pytest tests/test_tracker.py -v
"""

from __future__ import annotations

import numpy as np
import pytest

from src.tracking.tracker import TrackedObject, Tracker, TrackingResult


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def tracking_config() -> dict:
    """Minimal config for testing."""
    return {
        "model_path": "yolo26n.pt",  # auto-downloads if missing
        "confidence": 0.25,
        "iou_threshold": 0.45,
        "target_classes": ["person", "car", "truck", "bus", "motorcycle", "bicycle"],
        "device": "",
        "img_size": 640,
        "tracker": "bytetrack.yaml",
    }


@pytest.fixture(scope="module")
def tracker(tracking_config: dict) -> Tracker:
    """Shared Tracker instance (expensive to create)."""
    t = Tracker(tracking_config)
    t.warmup()
    return t


# ── Tests ────────────────────────────────────────────────────────────────────

class TestTrackerInit:
    """Test that the Tracker initialises correctly."""

    def test_model_loads(self, tracker: Tracker) -> None:
        assert tracker.model is not None

    def test_target_ids_populated(self, tracker: Tracker) -> None:
        assert len(tracker._target_ids) > 0, "Should have at least one target class ID"

    def test_config_stored(self, tracker: Tracker) -> None:
        assert tracker.confidence == 0.25
        assert tracker.img_size == 640
        assert tracker.tracker_type == "bytetrack.yaml"


class TestTrackedObject:
    """Test the TrackedObject dataclass."""

    def test_bbox_xywh(self) -> None:
        obj = TrackedObject(
            bbox_xyxy=(10, 20, 110, 220), confidence=0.9,
            class_id=0, class_name="person", track_id=1,
        )
        assert obj.bbox_xywh == (10, 20, 100, 200)

    def test_center(self) -> None:
        obj = TrackedObject(
            bbox_xyxy=(0, 0, 100, 100), confidence=0.5,
            class_id=2, class_name="car", track_id=2,
        )
        assert obj.center == (50, 50)

    def test_track_id(self) -> None:
        obj = TrackedObject(
            bbox_xyxy=(0, 0, 50, 50), confidence=0.8,
            class_id=0, class_name="person", track_id=42,
        )
        assert obj.track_id == 42

    def test_unassigned_track_id(self) -> None:
        obj = TrackedObject(
            bbox_xyxy=(0, 0, 50, 50), confidence=0.8,
            class_id=0, class_name="person", track_id=-1,
        )
        assert obj.track_id == -1


class TestTrackerInference:
    """Test that track() returns valid TrackingResult objects."""

    def test_track_on_blank_frame(self, tracker: Tracker) -> None:
        """A blank black frame should return zero or very few tracked objects."""
        blank = np.zeros((480, 640, 3), dtype=np.uint8)
        result = tracker.track(blank, frame_index=0)

        assert isinstance(result, TrackingResult)
        assert isinstance(result.tracked_objects, list)
        assert result.total_ms > 0, "Should report non-zero timing"

    def test_track_returns_tracked_objects(self, tracker: Tracker) -> None:
        """If there are detections, each should be a TrackedObject with valid fields."""
        rng = np.random.default_rng(42)
        noisy = rng.integers(0, 255, (480, 640, 3), dtype=np.uint8)
        result = tracker.track(noisy, frame_index=1)

        for obj in result.tracked_objects:
            assert isinstance(obj, TrackedObject)
            assert 0.0 <= obj.confidence <= 1.0
            assert isinstance(obj.class_name, str)
            assert len(obj.bbox_xyxy) == 4

    def test_class_filtering(self, tracker: Tracker) -> None:
        """All returned tracked objects should belong to target classes."""
        rng = np.random.default_rng(123)
        frame = rng.integers(0, 255, (480, 640, 3), dtype=np.uint8)
        result = tracker.track(frame)

        allowed = {"person", "car", "truck", "bus", "motorcycle", "bicycle"}
        for obj in result.tracked_objects:
            assert obj.class_name in allowed, f"Unexpected class: {obj.class_name}"

    def test_active_track_count_non_negative(self, tracker: Tracker) -> None:
        """active_track_count should always be >= 0."""
        blank = np.zeros((480, 640, 3), dtype=np.uint8)
        result = tracker.track(blank)
        assert result.active_track_count >= 0

    def test_frame_index_passed_through(self, tracker: Tracker) -> None:
        """frame_index should be preserved in the result."""
        blank = np.zeros((480, 640, 3), dtype=np.uint8)
        result = tracker.track(blank, frame_index=999)
        assert result.frame_index == 999


class TestTrackerTrackAge:
    """Test the track age tracking feature."""

    def test_get_track_age_unknown(self, tracker: Tracker) -> None:
        """Unknown track IDs should return age 0."""
        assert tracker.get_track_age(999999) == 0


class TestTrackerDrawing:
    """Test the draw utility."""

    def test_draw_returns_copy(self) -> None:
        """draw_tracks should not mutate the original frame."""
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        objs = [TrackedObject(
            bbox_xyxy=(10, 10, 50, 50), confidence=0.9,
            class_id=0, class_name="person", track_id=1,
        )]
        annotated = Tracker.draw_tracks(frame, objs)

        assert annotated is not frame, "Should return a copy"
        assert np.array_equal(
            frame, np.zeros((100, 100, 3), dtype=np.uint8),
        ), "Original should be unchanged"

    def test_draw_with_empty_list(self) -> None:
        """Drawing with no objects should return an identical copy."""
        frame = np.ones((100, 100, 3), dtype=np.uint8) * 128
        annotated = Tracker.draw_tracks(frame, [])
        assert np.array_equal(frame, annotated)

    def test_draw_with_unassigned_id(self) -> None:
        """Objects with track_id=-1 should still draw (without ID label)."""
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        objs = [TrackedObject(
            bbox_xyxy=(10, 10, 50, 50), confidence=0.9,
            class_id=0, class_name="person", track_id=-1,
        )]
        annotated = Tracker.draw_tracks(frame, objs)
        assert annotated is not frame
