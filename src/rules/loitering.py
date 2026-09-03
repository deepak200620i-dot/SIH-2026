"""
IBVAP — Loitering Detection Module
===================================
Tracks dwell-time of objects inside designated zones.
Emits LoiteringEvent alerts when dwell time exceeds configurable thresholds.

Usage:
    from src.rules.loitering import LoiteringDetector
    detector = LoiteringDetector(zones_config, threshold_seconds=60.0, cooldown_seconds=30.0)
    events = detector.check(tracked_objects, timestamp=time.time())
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np

from src.rules.virtual_fence import FenceZone


@dataclass
class LoiteringEvent:
    """Alert emitted when an object loiters inside a zone beyond threshold."""

    track_id: int
    zone_name: str
    dwell_time_seconds: float
    severity: str
    timestamp: float
    class_name: str
    confidence: float
    bbox_xyxy: tuple[int, int, int, int]
    center: tuple[int, int]


class LoiteringDetector:
    """
    Temporal dwell-time loitering detector.
    """

    def __init__(
        self,
        zones: list[dict[str, Any]],
        threshold_seconds: float = 60.0,
        cooldown_seconds: float = 30.0,
    ) -> None:
        self.zones: list[FenceZone] = []
        for z in zones:
            self.zones.append(
                FenceZone(
                    name=z["name"],
                    polygon=z["polygon"],
                    severity=z.get("severity", "high"),
                )
            )

        self.threshold_seconds = float(threshold_seconds)
        self.cooldown_seconds = float(cooldown_seconds)

        # Track entry timestamps: (track_id, zone_name) -> timestamp
        self._entry_times: dict[tuple[int, str], float] = {}

        # Cooldown state: (track_id, zone_name) -> timestamp
        self._last_alert: dict[tuple[int, str], float] = {}

    @staticmethod
    def is_inside(point: tuple[int, int], polygon: np.ndarray | list) -> bool:
        """Test if a point is inside a polygon using OpenCV pointPolygonTest."""
        if not isinstance(polygon, np.ndarray):
            polygon = np.array(polygon, dtype=np.int32)
        result = cv2.pointPolygonTest(
            polygon, (float(point[0]), float(point[1])), False
        )
        return result >= 0

    def get_dwell_time(
        self, track_id: int, zone_name: str, current_time: float
    ) -> float:
        """Return how long a track_id has been inside a specific zone."""
        key = (track_id, zone_name)
        if key in self._entry_times:
            return current_time - self._entry_times[key]
        return 0.0

    def check(
        self,
        tracked_objects: list[Any],
        timestamp: float | None = None,
    ) -> list[LoiteringEvent]:
        """
        Check all tracked objects against zones for loitering dwell time.
        """
        if timestamp is None:
            timestamp = time.time()

        events: list[LoiteringEvent] = []
        active_keys_this_frame: set[tuple[int, str]] = set()

        for obj in tracked_objects:
            track_id = getattr(obj, "track_id", -1)
            if track_id < 0:
                continue

            center = getattr(obj, "center", (0, 0))
            class_name = getattr(obj, "class_name", "object")
            confidence = getattr(obj, "confidence", 0.0)
            bbox_xyxy = getattr(obj, "bbox_xyxy", (0, 0, 0, 0))

            for zone in self.zones:
                key = (track_id, zone.name)

                if self.is_inside(center, zone.np_polygon):
                    active_keys_this_frame.add(key)

                    if key not in self._entry_times:
                        self._entry_times[key] = timestamp

                    dwell_time = timestamp - self._entry_times[key]

                    if dwell_time >= self.threshold_seconds:
                        # Check cooldown
                        if (
                            key not in self._last_alert
                            or (timestamp - self._last_alert[key]) >= self.cooldown_seconds
                        ):
                            events.append(
                                LoiteringEvent(
                                    track_id=track_id,
                                    zone_name=zone.name,
                                    dwell_time_seconds=round(dwell_time, 1),
                                    severity=zone.severity,
                                    timestamp=timestamp,
                                    class_name=class_name,
                                    confidence=confidence,
                                    bbox_xyxy=bbox_xyxy,
                                    center=center,
                                )
                            )
                            self._last_alert[key] = timestamp

        # Clean up entry times for objects that left the zone
        keys_to_remove = [k for k in self._entry_times if k not in active_keys_this_frame]
        for k in keys_to_remove:
            del self._entry_times[k]

        return events

    def reset(self) -> None:
        """Clear entry timestamps and cooldown state."""
        self._entry_times.clear()
        self._last_event.clear() if hasattr(self, "_last_event") else None
        self._last_alert.clear()
