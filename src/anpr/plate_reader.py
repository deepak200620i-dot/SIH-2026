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
BH_PLATE_REGEX = re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$")
GENERAL_PLATE_REGEX = re.compile(r"^[A-Z0-9]{5,10}$")

# Positional substitution maps for OCR error correction
DIGIT_TO_LETTER = {
    "0": "O", "1": "I", "2": "Z", "3": "J", "4": "A",
    "5": "S", "6": "G", "7": "T", "8": "B", "9": "P",
}

LETTER_TO_DIGIT = {
    "O": "0", "D": "0", "Q": "0", "U": "0",
    "I": "1", "L": "1", "T": "1",
    "Z": "2",
    "J": "3", "E": "3",
    "A": "4",
    "S": "5",
    "G": "6", "C": "6",
    "B": "8",
}


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
    Includes contrast enhancement, region focusing, and positional OCR correction.
    """

    DEFAULT_VEHICLE_CLASSES = {"car", "truck", "bus", "motorcycle"}

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        cfg = config or {}
        anpr_cfg = cfg.get("anpr", {})

        self.languages: list[str] = anpr_cfg.get("languages", ["en"])
        self.min_confidence: float = float(anpr_cfg.get("min_confidence", 0.35))
        self.vehicle_classes: set[str] = set(
            anpr_cfg.get("vehicle_classes", self.DEFAULT_VEHICLE_CLASSES)
        )
        self.gpu: bool = bool(anpr_cfg.get("gpu", False))

        self._reader: Any = None
        self._track_cache: dict[int, PlateMatch] = {}

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
        cleaned = re.sub(r"[^A-Za-z0-9]", "", raw_text).upper()
        return cleaned

    @classmethod
    def is_valid_plate(cls, plate_text: str) -> bool:
        """Validate if cleaned plate string matches valid license plate formats."""
        if not plate_text or len(plate_text) < 5 or len(plate_text) > 11:
            return False

        if INDIAN_PLATE_REGEX.match(plate_text):
            return True
        if BH_PLATE_REGEX.match(plate_text):
            return True
        if GENERAL_PLATE_REGEX.match(plate_text):
            return True

        return False

    @classmethod
    def correct_plate_format(cls, text: str) -> str:
        """
        Apply positional character correction based on standard plate structure.
        Standard 10-char: LL DD LL DDDD (e.g. MH12AB1234)
        Standard 9-char:  LL DD L DDDD  (e.g. DL01C1234)
        Standard 8-char:  LL DD DDDD    (e.g. DL011234)
        """
        if not text or len(text) < 7 or len(text) > 11:
            return text

        chars = list(text)
        n = len(chars)

        if n == 10:
            # LL DD LL DDDD
            chars[0] = DIGIT_TO_LETTER.get(chars[0], chars[0])
            chars[1] = DIGIT_TO_LETTER.get(chars[1], chars[1])
            chars[2] = LETTER_TO_DIGIT.get(chars[2], chars[2])
            chars[3] = LETTER_TO_DIGIT.get(chars[3], chars[3])
            chars[4] = DIGIT_TO_LETTER.get(chars[4], chars[4])
            chars[5] = DIGIT_TO_LETTER.get(chars[5], chars[5])
            for i in range(6, 10):
                chars[i] = LETTER_TO_DIGIT.get(chars[i], chars[i])
        elif n == 9:
            # LL DD L DDDD
            chars[0] = DIGIT_TO_LETTER.get(chars[0], chars[0])
            chars[1] = DIGIT_TO_LETTER.get(chars[1], chars[1])
            chars[2] = LETTER_TO_DIGIT.get(chars[2], chars[2])
            chars[3] = LETTER_TO_DIGIT.get(chars[3], chars[3])
            chars[4] = DIGIT_TO_LETTER.get(chars[4], chars[4])
            for i in range(5, 9):
                chars[i] = LETTER_TO_DIGIT.get(chars[i], chars[i])
        elif n == 8:
            # LL DD DDDD
            chars[0] = DIGIT_TO_LETTER.get(chars[0], chars[0])
            chars[1] = DIGIT_TO_LETTER.get(chars[1], chars[1])
            for i in range(2, 8):
                chars[i] = LETTER_TO_DIGIT.get(chars[i], chars[i])

        candidate = "".join(chars)
        if cls.is_valid_plate(candidate):
            return candidate
        return text

    @staticmethod
    def preprocess_plate_image(image: np.ndarray) -> np.ndarray:
        """
        Enhance plate contrast and clarity for OCR using grayscale, CLAHE, and bilateral filtering.
        """
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        contrast = clahe.apply(gray)
        filtered = cv2.bilateralFilter(contrast, 7, 50, 50)
        return filtered

    def read_plate(
        self,
        frame: np.ndarray,
        vehicle_bbox: tuple[int, int, int, int],
        track_id: int = -1,
        class_name: str = "car",
    ) -> PlateMatch | None:
        """
        Crop vehicle region from frame, focus on plate zone, preprocess, and extract plate text.
        """
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = vehicle_bbox

        x1_c, y1_c = max(0, x1), max(0, y1)
        x2_c, y2_c = min(w, x2), min(h, y2)

        vh = y2_c - y1_c
        vw = x2_c - x1_c
        if vw < 30 or vh < 30:
            return None

        # Vehicle plates reside in the lower 60% of vehicle bounding boxes
        lower_y1 = y1_c + int(vh * 0.35)
        lower_crop = frame[lower_y1:y2_c, x1_c:x2_c]
        if lower_crop.size == 0:
            lower_crop = frame[y1_c:y2_c, x1_c:x2_c]
            lower_y1 = y1_c

        self._load_reader()

        # Run OCR on both preprocessed and raw crops for best candidate extraction
        crops_to_try = [
            (self.preprocess_plate_image(lower_crop), lower_y1, x1_c),
            (lower_crop, lower_y1, x1_c),
        ]

        best_match: PlateMatch | None = None
        best_score = 0.0

        for crop_img, crop_top, crop_left in crops_to_try:
            try:
                results = self._reader.readtext(
                    crop_img,
                    allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
                    detail=1,
                )
            except Exception:
                continue

            for bbox_coords, raw_text, conf in results:
                cleaned = self.clean_text(raw_text)
                corrected = self.correct_plate_format(cleaned)

                candidate = corrected if self.is_valid_plate(corrected) else cleaned
                if not self.is_valid_plate(candidate) or conf < self.min_confidence:
                    continue

                # Bonus score if it matches the strict Indian / BH plate format
                is_standard = bool(INDIAN_PLATE_REGEX.match(candidate) or BH_PLATE_REGEX.match(candidate))
                score = float(conf) + (0.35 if is_standard else 0.0)

                if score > best_score:
                    best_score = score
                    plate_bbox = None
                    if bbox_coords and len(bbox_coords) == 4:
                        pts = np.array(bbox_coords, dtype=np.int32)
                        px1 = pts[:, 0].min() + crop_left
                        py1 = pts[:, 1].min() + crop_top
                        px2 = pts[:, 0].max() + crop_left
                        py2 = pts[:, 1].max() + crop_top
                        plate_bbox = (int(px1), int(py1), int(px2), int(py2))

                    best_match = PlateMatch(
                        plate_text=candidate,
                        confidence=round(float(conf), 4),
                        vehicle_track_id=track_id,
                        vehicle_bbox=(x1, y1, x2, y2),
                        plate_bbox=plate_bbox,
                        class_name=class_name,
                    )

        # Track-based stabilization: if current read is weak or empty, fallback to cached
        if track_id >= 0:
            if best_match and best_match.confidence >= 0.50:
                self._track_cache[track_id] = best_match
            elif not best_match and track_id in self._track_cache:
                cached = self._track_cache[track_id]
                best_match = PlateMatch(
                    plate_text=cached.plate_text,
                    confidence=cached.confidence,
                    vehicle_track_id=track_id,
                    vehicle_bbox=(x1, y1, x2, y2),
                    plate_bbox=cached.plate_bbox,
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

    def reset(self) -> None:
        """Clear cached track plate associations."""
        self._track_cache.clear()

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
