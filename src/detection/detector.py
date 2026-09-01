"""
IBVAP — YOLO26n Object Detector
================================
Thin, testable wrapper around Ultralytics YOLO for person/vehicle detection.

Usage:
    from src.detection.detector import Detector
    det = Detector(config)
    detections = det.detect(frame)
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from ultralytics import YOLO


# ── Structured detection result ──────────────────────────────────────────────

@dataclass
class Detection:
    """Single detected object in a frame."""

    bbox_xyxy: tuple[int, int, int, int]  # (x1, y1, x2, y2) pixel coords
    confidence: float                      # 0-1
    class_id: int                          # COCO class index
    class_name: str                        # e.g. "person", "car"

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


# ── Frame-level results container ───────────────────────────────────────────

@dataclass
class FrameResult:
    """All detections for a single frame, plus timing metadata."""

    detections: list[Detection] = field(default_factory=list)
    inference_ms: float = 0.0       # YOLO inference time in ms
    total_ms: float = 0.0           # Total detect() wall-clock time in ms
    frame_index: int = -1


# ── Detector class ───────────────────────────────────────────────────────────

# COCO class names that YOLO uses — needed for filtering by name
_COCO_NAMES: dict[int, str] = {
    0: "person", 1: "bicycle", 2: "car", 3: "motorcycle", 4: "airplane",
    5: "bus", 6: "train", 7: "truck", 8: "boat", 9: "traffic light",
    10: "fire hydrant", 11: "stop sign", 12: "parking meter", 13: "bench",
    # (only the classes we care about are listed; YOLO has 80 total)
}


class Detector:
    """
    YOLO26n object detector.

    Parameters
    ----------
    config : dict
        The ``detection`` section of settings.yaml, e.g.::

            {
                "model_path": "models/yolo26n.pt",
                "confidence": 0.35,
                "iou_threshold": 0.45,
                "target_classes": ["person", "car", "truck", "bus", "motorcycle", "bicycle"],
                "device": "",
                "img_size": 640,
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

        # Build a set of COCO class IDs we want to keep
        self._target_ids: set[int] = set()
        for cls_id, cls_name in _COCO_NAMES.items():
            if cls_name in self.target_classes:
                self._target_ids.add(cls_id)

        # Also build from the model's own names dict (covers all 80 classes)
        # This is done lazily after model load.
        self._model_names: dict[int, str] = {}

        # Load the model
        self.model = self._load_model()

    # ── Private helpers ──────────────────────────────────────────────────

    def _load_model(self) -> YOLO:
        """Load the YOLO model. Auto-downloads weights on first run."""
        model = YOLO(self.model_path)

        # Cache the model's own class-name mapping
        if hasattr(model, "names"):
            self._model_names = model.names  # {0: "person", 1: "bicycle", ...}
            # Rebuild target IDs from the model's actual mapping
            self._target_ids = {
                cid for cid, cname in self._model_names.items()
                if cname in self.target_classes
            }

        return model

    def _parse_results(self, results: Any) -> list[Detection]:
        """Convert Ultralytics Results into a list of Detection dataclasses."""
        detections: list[Detection] = []

        for result in results:
            boxes = result.boxes
            if boxes is None or len(boxes) == 0:
                continue

            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())

                # Filter: only keep target classes
                if cls_id not in self._target_ids:
                    continue

                conf = float(boxes.conf[i].item())
                x1, y1, x2, y2 = boxes.xyxy[i].tolist()
                cls_name = self._model_names.get(cls_id, f"class_{cls_id}")

                detections.append(Detection(
                    bbox_xyxy=(int(x1), int(y1), int(x2), int(y2)),
                    confidence=round(conf, 4),
                    class_id=cls_id,
                    class_name=cls_name,
                ))

        return detections

    # ── Public API ───────────────────────────────────────────────────────

    def detect(self, frame: np.ndarray, frame_index: int = -1) -> FrameResult:
        """
        Run detection on a single BGR frame.

        Returns a FrameResult with structured detections and timing info.
        """
        t_start = time.perf_counter()

        results = self.model.predict(
            source=frame,
            conf=self.confidence,
            iou=self.iou_threshold,
            device=self.device if self.device else None,
            imgsz=self.img_size,
            verbose=False,
        )

        t_end = time.perf_counter()

        # Extract inference time reported by YOLO (if available)
        inference_ms = 0.0
        if results and hasattr(results[0], "speed"):
            speed = results[0].speed  # dict with 'preprocess', 'inference', 'postprocess'
            inference_ms = speed.get("inference", 0.0)

        detections = self._parse_results(results)

        return FrameResult(
            detections=detections,
            inference_ms=round(inference_ms, 2),
            total_ms=round((t_end - t_start) * 1000, 2),
            frame_index=frame_index,
        )

    def warmup(self, imgsz: int | None = None) -> None:
        """Run a dummy inference to warm up the model (allocate GPU memory, etc.)."""
        sz = imgsz or self.img_size
        dummy = np.zeros((sz, sz, 3), dtype=np.uint8)
        self.detect(dummy, frame_index=-1)

    # ── Drawing utility ──────────────────────────────────────────────────

    @staticmethod
    def draw_detections(
        frame: np.ndarray,
        detections: list[Detection],
        color_map: dict[str, tuple[int, int, int]] | None = None,
    ) -> np.ndarray:
        """
        Draw bounding boxes and labels on a frame (returns a copy).

        Parameters
        ----------
        frame : np.ndarray
            BGR image.
        detections : list[Detection]
            Detections to draw.
        color_map : dict, optional
            Map of class_name → BGR color. Defaults provided for common classes.
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

        for det in detections:
            x1, y1, x2, y2 = det.bbox_xyxy
            color = cmap.get(det.class_name, fallback_color)

            # Bounding box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

            # Label background
            label = f"{det.class_name} {det.confidence:.2f}"
            (tw, th), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(annotated, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)

            # Label text
            cv2.putText(
                annotated, label, (x1 + 2, y1 - 4),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA,
            )

        return annotated
