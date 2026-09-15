"""Custom-model weapon detection for defensive surveillance.

The stock COCO model used for people and vehicles has no weapon classes.  This
module deliberately loads only an operator-supplied, local YOLO model trained
for weapon detection; it never relabels ordinary COCO objects as weapons.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from ultralytics import YOLO


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class WeaponDetection:
    """A weapon reported by the dedicated custom detector."""

    bbox_xyxy: tuple[int, int, int, int]
    confidence: float
    class_id: int
    class_name: str

    @property
    def center(self) -> tuple[int, int]:
        x1, y1, x2, y2 = self.bbox_xyxy
        return ((x1 + x2) // 2, (y1 + y2) // 2)


class WeaponDetector:
    """Optional local YOLO detector restricted to configured weapon labels."""

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        cfg = config or {}
        self.enabled = bool(cfg.get("enabled", True))
        self.model_path = Path(cfg.get("model_path", "models/weapon_detector.pt"))
        self.confidence = float(cfg.get("confidence", 0.45))
        self.iou_threshold = float(cfg.get("iou_threshold", 0.45))
        self.img_size = int(cfg.get("img_size", 640))
        self.device = cfg.get("device", "")
        self.weapon_labels = {self._normalise(label) for label in cfg.get("weapon_labels", [])}
        self.model: YOLO | None = None
        self._model_names: dict[int, str] = {}

        if not self.enabled:
            return
        if not self.model_path.is_file():
            logger.warning(
                "Weapon detection is disabled: custom model not found at %s", self.model_path
            )
            return

        self.model = YOLO(str(self.model_path))
        names = getattr(self.model, "names", {})
        self._model_names = dict(names) if isinstance(names, dict) else {}
        logger.info("Weapon detection model loaded from %s", self.model_path)

    @property
    def available(self) -> bool:
        return self.model is not None

    @staticmethod
    def _normalise(label: str) -> str:
        return label.strip().lower().replace("-", "_").replace(" ", "_")

    def detect(self, frame: np.ndarray) -> list[WeaponDetection]:
        """Detect configured weapon classes, returning no results when disabled."""
        if self.model is None:
            return []

        results = self.model.predict(
            source=frame,
            conf=self.confidence,
            iou=self.iou_threshold,
            device=self.device or None,
            imgsz=self.img_size,
            verbose=False,
        )
        detections: list[WeaponDetection] = []
        for result in results:
            if result.boxes is None:
                continue
            for index in range(len(result.boxes)):
                class_id = int(result.boxes.cls[index].item())
                class_name = self._normalise(self._model_names.get(class_id, f"class_{class_id}"))
                if self.weapon_labels and class_name not in self.weapon_labels:
                    continue
                x1, y1, x2, y2 = result.boxes.xyxy[index].tolist()
                detections.append(
                    WeaponDetection(
                        bbox_xyxy=(int(x1), int(y1), int(x2), int(y2)),
                        confidence=round(float(result.boxes.conf[index].item()), 4),
                        class_id=class_id,
                        class_name=class_name,
                    )
                )
        return detections

    @staticmethod
    def draw_detections(frame: np.ndarray, detections: list[WeaponDetection]) -> np.ndarray:
        """Draw high-visibility weapon boxes on an evidence frame."""
        annotated = frame.copy()
        for detection in detections:
            x1, y1, x2, y2 = detection.bbox_xyxy
            label = f"WEAPON: {detection.class_name.upper()} {detection.confidence:.2f}"
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 3)
            cv2.putText(
                annotated, label, (x1, max(18, y1 - 7)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 2, cv2.LINE_AA,
            )
        return annotated
