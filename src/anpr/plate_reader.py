"""
IBVAP — Automatic Number Plate Recognition (ANPR) Module
========================================================
Crops vehicle bounding boxes, applies EasyOCR for license plate reading,
cleans and validates text using standard plate patterns, and outputs PlateMatch results.

Usage:
    from src.anpr.plate_reader import PlateReader
    reader = PlateReader(config)
    matches = reader.read_frame(frame, tracked_objects)
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Optional

import cv2
import numpy as np

# Standard license plate regex (e.g. Indian plates: MH12AB1234 or DL01C1234, or general alphanumeric 5-10 chars)
INDIAN_PLATE_REGEX = re.compile(r"^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$")
GENERAL_PLATE_REGEX = re.compile(r"^[A-Z0-9]{5,10}$")


@dataclass
class PlateMatch:
    """Dataclass holding extracted license plate result."""

    plate_text: str
    confidence: float
    vehicle_track_id: int
    vehicle_bbox: tuple[int, int, int, int]
    plate_bbox: Optional[tuple[int, int, int, int]] = None
    class_name: str = "car"


class PlateReader:
    """
    ANPR engine wrapping EasyOCR for license plate reading from vehicle crops.
    """

    DEFAULT_VEHICLE_CLASSES = {"car", "truck", "bus", "motorcycle"}

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        cfg = config or {}
        anpr_cfg = cfg.get("anpr", {})

        self.languages: list[str] = anpr_cfg.get("languages", ["en"])
        self.min_confidence: float = float(anpr_cfg.get("min_confidence", 0.4))
        self.vehicle_classes: set[str] = set(
            anpr_cfg.get("vehicle_classes", self.DEFAULT_VEHICLE_CLASSES)
        )
        self.gpu: bool = bool(anpr_cfg.get("gpu", False))

        self._reader: Any = None

    def _load_reader(self) -> None:
        """Lazy loader for EasyOCR Reader."""
        if self._reader is None:
            try:
                import easyocr
                self._reader = easyocr.Reader(self.languages, gpu=self.gpu)
            except ImportError:
                raise ImportError(
                    "EasyOCR is not installed. Please install it with `pip install easyocr`."
                )

    @staticmethod
    def clean_text(raw_text: str) -> str:
        """Clean OCR text by removing non-alphanumeric characters and converting to uppercase."""
        if not raw_text:
            return ""
        # Remove symbols, keep uppercase A-Z and digits 0-9
        cleaned = re.sub(r"[^A-Za-z0-9]", "", raw_text).upper()
        return cleaned

    @classmethod
    def is_valid_plate(cls, plate_text: str) -> bool:
        """Validate if cleaned plate string matches valid license plate formats."""
        if not plate_text or len(plate_text) < 5 or len(plate_text) > 11:
            return False

        if INDIAN_PLATE_REGEX.match(plate_text):
            return True
        if GENERAL_PLATE_REGEX.match(plate_text):
            return True

        return False

    def read_plate(
        self,
        frame: np.ndarray,
        vehicle_bbox: tuple[int, int, int, int],
        track_id: int = -1,
        class_name: str = "car",
    ) -> PlateMatch | None:
        """
        Crop vehicle region from frame and extract license plate text.
        """
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = vehicle_bbox

        x1_c, y1_c = max(0, x1), max(0, y1)
        x2_c, y2_c = min(w, x2), min(h, y2)

        if (x2_c - x1_c) < 30 or (y2_c - y1_c) < 30:
            return None

        vehicle_crop = frame[y1_c:y2_c, x1_c:x2_c]
        if vehicle_crop.size == 0:
            return None

        self._load_reader()
        results = self._reader.readtext(vehicle_crop)

        best_match: PlateMatch | None = None
        best_conf = 0.0

        for bbox_coords, raw_text, conf in results:
            cleaned = self.clean_text(raw_text)
            if conf >= self.min_confidence and self.is_valid_plate(cleaned):
                if conf > best_conf:
                    best_conf = float(conf)

                    # Convert crop-relative bbox to full frame bbox if available
                    plate_bbox = None
                    if bbox_coords and len(bbox_coords) == 4:
                        pts = np.array(bbox_coords, dtype=np.int32)
                        px1, py1 = pts[:, 0].min() + x1_c, pts[:, 1].min() + y1_c
                        px2, py2 = pts[:, 0].max() + x1_c, pts[:, 1].max() + y1_c
                        plate_bbox = (int(px1), int(py1), int(px2), int(py2))

                    best_match = PlateMatch(
                        plate_text=cleaned,
                        confidence=best_conf,
                        vehicle_track_id=track_id,
                        vehicle_bbox=(x1, y1, x2, y2),
                        plate_bbox=plate_bbox,
                        class_name=class_name,
                    )

        return best_match

    def read_frame(
        self,
        frame: np.ndarray,
        tracked_objects: list[Any],
    ) -> list[PlateMatch]:
        """
        Process frame for tracked vehicles and extract license plate matches.
        """
        matches: list[PlateMatch] = []
        for obj in tracked_objects:
            cls_name = getattr(obj, "class_name", "").lower()
            if cls_name in self.vehicle_classes:
                bbox = getattr(obj, "bbox_xyxy", None)
                track_id = getattr(obj, "track_id", -1)
                if bbox is not None and len(bbox) == 4:
                    match = self.read_plate(frame, bbox, track_id=track_id, class_name=cls_name)
                    if match:
                        matches.append(match)
        return matches

    @staticmethod
    def draw_plate_matches(
        frame: np.ndarray,
        matches: list[PlateMatch],
    ) -> np.ndarray:
        """
        Draw license plate labels over vehicle bounding boxes.
        """
        annotated = frame.copy()
        for match in matches:
            vx1, vy1, vx2, vy2 = match.vehicle_bbox
            color = (255, 165, 0)  # Cyan/Orange badge

            # Draw vehicle box
            cv2.rectangle(annotated, (vx1, vy1), (vx2, vy2), color, 2)

            # Label text
            label = f"PLATE: {match.plate_text} ({match.confidence:.2f})"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)

            cv2.rectangle(
                annotated,
                (vx1, max(0, vy1 - th - 6)),
                (vx1 + tw + 6, max(th + 6, vy1)),
                color,
                -1,
            )
            cv2.putText(
                annotated,
                label,
                (vx1 + 3, max(th, vy1 - 3)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 0),
                1,
                cv2.LINE_AA,
            )

            # Highlight specific plate box if available
            if match.plate_bbox:
                px1, py1, px2, py2 = match.plate_bbox
                cv2.rectangle(annotated, (px1, py1), (px2, py2), (0, 255, 255), 2)

        return annotated
