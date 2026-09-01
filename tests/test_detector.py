"""
IBVAP — Unit tests for the Detector module
============================================
Tests that the Detector loads, runs inference, and produces correct output.

Run:
    python -m pytest tests/test_detector.py -v
"""

from __future__ import annotations

import numpy as np
import pytest

from src.detection.detector import Detection, Detector, FrameResult


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def detection_config() -> dict:
    """Minimal config for testing."""
    return {
        "model_path": "yolo26n.pt",  # auto-downloads if missing
        "confidence": 0.25,
        "iou_threshold": 0.45,
        "target_classes": ["person", "car", "truck", "bus", "motorcycle", "bicycle"],
        "device": "",
        "img_size": 640,
    }


@pytest.fixture(scope="module")
def detector(detection_config: dict) -> Detector:
    """Shared Detector instance (expensive to create)."""
    det = Detector(detection_config)
    det.warmup()
    return det


# ── Tests ────────────────────────────────────────────────────────────────────

class TestDetectorInit:
    """Test that the Detector initialises correctly."""

    def test_model_loads(self, detector: Detector) -> None:
        assert detector.model is not None

    def test_target_ids_populated(self, detector: Detector) -> None:
        assert len(detector._target_ids) > 0, "Should have at least one target class ID"

    def test_config_stored(self, detector: Detector) -> None:
        assert detector.confidence == 0.25
        assert detector.img_size == 640


class TestDetection:
    """Test the Detection dataclass."""

    def test_bbox_xywh(self) -> None:
        det = Detection(bbox_xyxy=(10, 20, 110, 220), confidence=0.9, class_id=0, class_name="person")
        assert det.bbox_xywh == (10, 20, 100, 200)

    def test_center(self) -> None:
        det = Detection(bbox_xyxy=(0, 0, 100, 100), confidence=0.5, class_id=2, class_name="car")
        assert det.center == (50, 50)


class TestDetectorInference:
    """Test that detect() returns valid FrameResult objects."""

    def test_detect_on_blank_frame(self, detector: Detector) -> None:
        """A blank black frame should return zero or very few detections."""
        blank = np.zeros((480, 640, 3), dtype=np.uint8)
        result = detector.detect(blank, frame_index=0)

        assert isinstance(result, FrameResult)
        assert isinstance(result.detections, list)
        assert result.total_ms > 0, "Should report non-zero timing"
        assert result.frame_index == 0

    def test_detect_returns_detection_objects(self, detector: Detector) -> None:
        """If there are detections, each should be a Detection with valid fields."""
        # Create a random noise frame — might produce false positives, but
        # we're testing structure, not accuracy.
        rng = np.random.default_rng(42)
        noisy = rng.integers(0, 255, (480, 640, 3), dtype=np.uint8)
        result = detector.detect(noisy, frame_index=1)

        for det in result.detections:
            assert isinstance(det, Detection)
            assert 0.0 <= det.confidence <= 1.0
            assert isinstance(det.class_name, str)
            assert len(det.bbox_xyxy) == 4

    def test_class_filtering(self, detector: Detector) -> None:
        """All returned detections should belong to target classes."""
        rng = np.random.default_rng(123)
        frame = rng.integers(0, 255, (480, 640, 3), dtype=np.uint8)
        result = detector.detect(frame)

        allowed = {"person", "car", "truck", "bus", "motorcycle", "bicycle"}
        for det in result.detections:
            assert det.class_name in allowed, f"Unexpected class: {det.class_name}"


class TestDrawDetections:
    """Test the draw utility."""

    def test_draw_returns_copy(self) -> None:
        """draw_detections should not mutate the original frame."""
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        dets = [Detection(bbox_xyxy=(10, 10, 50, 50), confidence=0.9, class_id=0, class_name="person")]
        annotated = Detector.draw_detections(frame, dets)

        assert annotated is not frame, "Should return a copy"
        assert np.array_equal(frame, np.zeros((100, 100, 3), dtype=np.uint8)), "Original should be unchanged"

    def test_draw_with_empty_detections(self) -> None:
        """Drawing with no detections should return a clean copy."""
        frame = np.ones((100, 100, 3), dtype=np.uint8) * 128
        annotated = Detector.draw_detections(frame, [])
        assert np.array_equal(frame, annotated)
