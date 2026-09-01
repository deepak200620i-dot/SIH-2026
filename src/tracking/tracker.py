"""
IBVAP — ByteTrack Object Tracker
==================================
Wraps Ultralytics YOLO model.track() to assign persistent IDs to detected
objects across frames using the ByteTrack algorithm.

Usage:
    from src.tracking.tracker import Tracker
    tracker = Tracker(config)
    result = tracker.track(frame)
    for obj in result.tracked_objects:
        print(obj.track_id, obj.class_name, obj.center)
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np
from ultralytics import YOLO


# ── Structured tracked-object result ────────────────────────────────────────

@dataclass
class TrackedObject:
    """A detected object with a persistent tracking ID from ByteTrack."""

    bbox_xyxy: tuple[int, int, int, int]  # (x1, y1, x2, y2) pixel coords
    confidence: float                      # 0-1
    class_id: int                          # COCO class index
    class_name: str                        # e.g. "person", "car"
    track_id: int                          # Persistent ID from ByteTrack (-1 if unassigned)

    @property
    def bbox_xywh(self) -> tuple[int, int, int, int]:
        """Convert to (x, y, w, h) format."""
        x1, y1, x2, y2 = self.bbox_xyxy
        return (x1, y1, x2 - x1, y2 - y1)

    @property
    def center(self) -> tuple[int, int]:
        """Centre point of the bounding box."""
        x1, y1, x2, y2 = self.bbox_xyxy
        return ((x1 + x2) // 2, (y1 + y2) // 2)


# ── Frame-level tracking result ────────────────────────────────────────────

@dataclass
class TrackingResult:
    """All tracked objects for a single frame, plus timing metadata."""

    tracked_objects: list[TrackedObject] = field(default_factory=list)
    inference_ms: float = 0.0        # YOLO inference time in ms
    total_ms: float = 0.0            # Total track() wall-clock time in ms
    frame_index: int = -1
    active_track_count: int = 0      # Number of unique active tracks this frame


# ── COCO class names ────────────────────────────────────────────────────────

_COCO_NAMES: dict[int, str] = {
    0: "person", 1: "bicycle", 2: "car", 3: "motorcycle", 4: "airplane",
    5: "bus", 6: "train", 7: "truck", 8: "boat", 9: "traffic light",
    10: "fire hydrant", 11: "stop sign", 12: "parking meter", 13: "bench",
}


# ── Tracker class ───────────────────────────────────────────────────────────

class Tracker:
    """
    ByteTrack object tracker using Ultralytics ``model.track()``.

    Assigns persistent IDs to detected objects across frames.  The tracker
    maintains internal state (via ``persist=True``) so the same ``Tracker``
    instance must be used for all frames in a video sequence.

    Parameters
    ----------
    config : dict
        The ``detection`` section of settings.yaml (same keys as Detector),
        optionally extended with ``tracker`` key::

            {
                "model_path": "models/yolo26n.pt",
                "confidence": 0.35,
                "iou_threshold": 0.45,
                "target_classes": ["person", "car", ...],
                "device": "",
                "img_size": 640,
                "tracker": "bytetrack.yaml",
            }
    """

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.model_path = config.get("model_path", "models/yolo26n.pt")
        self.confidence = config.get("confidence", 0.35)
        self.iou_threshold = config.get("iou_threshold", 0.45)
        self.target_classes = set(config.get("target_classes", ["person", "car"]))
        self.device = config.get("device", "")  # "" = auto
        self.img_size = config.get("img_size", 640)
        self.tracker_type = config.get("tracker", "bytetrack.yaml")

        # Build target class ID set
        self._target_ids: set[int] = set()
        self._model_names: dict[int, str] = {}

        # Track history: track_id → frame index when first seen
        self._track_history: dict[int, int] = {}
        self._frame_count: int = 0

        # Load the model
        self.model = self._load_model()

    # ── Private helpers ──────────────────────────────────────────────────

    def _load_model(self) -> YOLO:
        """Load the YOLO model. Auto-downloads weights on first run."""
        model = YOLO(self.model_path)

        if hasattr(model, "names"):
            self._model_names = model.names
            self._target_ids = {
                cid for cid, cname in self._model_names.items()
                if cname in self.target_classes
            }

        return model

    def _parse_results(self, results: Any) -> list[TrackedObject]:
        """Convert Ultralytics tracking results to TrackedObject list."""
        tracked: list[TrackedObject] = []

        for result in results:
            boxes = result.boxes
            if boxes is None or len(boxes) == 0:
                continue

            # Track IDs may not be available on every frame
            has_ids = boxes.id is not None

            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())

                # Filter: only keep target classes
                if cls_id not in self._target_ids:
                    continue

                conf = float(boxes.conf[i].item())
                x1, y1, x2, y2 = boxes.xyxy[i].tolist()
                cls_name = self._model_names.get(cls_id, f"class_{cls_id}")

                # Get track ID (-1 if tracker hasn't assigned one yet)
                track_id = int(boxes.id[i].item()) if has_ids else -1

                # Record first-seen frame for track age calculation
                if track_id >= 0 and track_id not in self._track_history:
                    self._track_history[track_id] = self._frame_count

                tracked.append(TrackedObject(
                    bbox_xyxy=(int(x1), int(y1), int(x2), int(y2)),
                    confidence=round(conf, 4),
                    class_id=cls_id,
                    class_name=cls_name,
                    track_id=track_id,
                ))

        return tracked

    # ── Public API ───────────────────────────────────────────────────────

    def track(self, frame: np.ndarray, frame_index: int = -1) -> TrackingResult:
        """
        Run tracking on a single BGR frame.

        Returns a TrackingResult with tracked objects and timing info.
        Must be called sequentially on consecutive frames from the same video.
        """
        t_start = time.perf_counter()

        results = self.model.track(
            source=frame,
            conf=self.confidence,
            iou=self.iou_threshold,
            device=self.device if self.device else None,
            imgsz=self.img_size,
            tracker=self.tracker_type,
            persist=True,
            verbose=False,
        )

        t_end = time.perf_counter()

        # Extract YOLO-reported inference time
        inference_ms = 0.0
        if results and hasattr(results[0], "speed"):
            speed = results[0].speed
            inference_ms = speed.get("inference", 0.0)

        tracked_objects = self._parse_results(results)
        self._frame_count += 1

        # Count unique active tracks this frame
        active_ids = {obj.track_id for obj in tracked_objects if obj.track_id >= 0}

        return TrackingResult(
            tracked_objects=tracked_objects,
            inference_ms=round(inference_ms, 2),
            total_ms=round((t_end - t_start) * 1000, 2),
            frame_index=frame_index,
            active_track_count=len(active_ids),
        )

    def get_track_age(self, track_id: int) -> int:
        """Return the number of frames since this track_id was first seen."""
        if track_id in self._track_history:
            return self._frame_count - self._track_history[track_id]
        return 0

    def reset(self) -> None:
        """
        Reset all tracking state.

        Call when switching to a new video or restarting the pipeline.
        This clears ByteTrack's internal state and the track history.
        """
        # Clear Ultralytics internal tracker state
        if hasattr(self.model, "predictor") and self.model.predictor is not None:
            self.model.predictor = None
        self._track_history.clear()
        self._frame_count = 0

    def warmup(self, imgsz: int | None = None) -> None:
        """Run a dummy inference to warm up the model + tracker."""
        sz = imgsz or self.img_size
        dummy = np.zeros((sz, sz, 3), dtype=np.uint8)
        self.track(dummy, frame_index=-1)

    # ── Drawing utility ──────────────────────────────────────────────────

    @staticmethod
    def draw_tracks(
        frame: np.ndarray,
        tracked_objects: list[TrackedObject],
        color_map: dict[str, tuple[int, int, int]] | None = None,
    ) -> np.ndarray:
        """
        Draw bounding boxes with track IDs and centre dots (returns a copy).

        Parameters
        ----------
        frame : np.ndarray
            BGR image.
        tracked_objects : list[TrackedObject]
            Objects to draw.
        color_map : dict, optional
            Map of class_name → BGR colour.
        """
        annotated = frame.copy()

        default_colors: dict[str, tuple[int, int, int]] = {
            "person":     (0, 255, 0),     # green
            "car":        (255, 165, 0),   # orange-ish
            "truck":      (0, 165, 255),   # orange (BGR)
            "bus":        (0, 200, 200),   # yellow-ish
            "motorcycle": (255, 0, 255),   # magenta
            "bicycle":    (255, 255, 0),   # cyan
        }
        cmap = color_map or default_colors
        fallback_color = (200, 200, 200)

        for obj in tracked_objects:
            x1, y1, x2, y2 = obj.bbox_xyxy
            color = cmap.get(obj.class_name, fallback_color)

            # Bounding box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

            # Label with track ID
            if obj.track_id >= 0:
                label = f"ID:{obj.track_id} {obj.class_name} {obj.confidence:.2f}"
            else:
                label = f"{obj.class_name} {obj.confidence:.2f}"

            (tw, th), baseline = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1,
            )
            cv2.rectangle(
                annotated, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1,
            )
            cv2.putText(
                annotated, label, (x1 + 2, y1 - 4),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA,
            )

            # Centre dot
            cx, cy = obj.center
            cv2.circle(annotated, (cx, cy), 4, color, -1)

        return annotated
