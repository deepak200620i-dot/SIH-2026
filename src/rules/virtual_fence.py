"""
IBVAP — Virtual Fence (Polygon Zone Intrusion Detection)
==========================================================
Checks whether tracked objects' centre points fall inside restricted
polygon zones.  Emits FenceEvent alerts with severity and debouncing
to prevent alert floods.

Usage:
    from src.rules.virtual_fence import VirtualFence
    fence = VirtualFence(zones_config, cooldown_seconds=30)
    events = fence.check(tracked_objects, timestamp=time.time())
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np


# ── Zone definition ─────────────────────────────────────────────────────────

@dataclass
class FenceZone:
    """A restricted polygon zone on the video frame."""

    name: str                          # Human-readable zone name
    polygon: list[list[int]]           # [[x1,y1], [x2,y2], ...] vertices
    severity: str = "high"             # "low", "medium", "high", "critical"

    @property
    def np_polygon(self) -> np.ndarray:
        """Polygon as a numpy int32 contour (required by OpenCV)."""
        return np.array(self.polygon, dtype=np.int32)


# ── Alert event ─────────────────────────────────────────────────────────────

@dataclass
class FenceEvent:
    """Alert generated when a tracked object enters a restricted zone."""

    track_id: int
    zone_name: str
    severity: str
    timestamp: float
    class_name: str
    confidence: float
    bbox_xyxy: tuple[int, int, int, int]
    center: tuple[int, int]


# ── Virtual Fence class ─────────────────────────────────────────────────────

class VirtualFence:
    """
    Polygon zone intrusion detector with cooldown-based debouncing.

    For each tracked object, tests whether its centre point falls inside
    any configured zone polygon using ``cv2.pointPolygonTest``.
    When an intrusion is detected, a ``FenceEvent`` is emitted — but
    repeated alerts for the same ``(track_id, zone_name)`` pair are
    suppressed for ``cooldown_seconds``.

    Parameters
    ----------
    zones : list[dict]
        Zone definitions from ``settings.yaml``::

            [
                {
                    "name": "restricted_area_1",
                    "polygon": [[100,200], [400,200], [400,500], [100,500]],
                    "severity": "high",
                },
            ]

    cooldown_seconds : float
        Minimum gap between duplicate alerts for the same track + zone.
    """

    def __init__(
        self,
        zones: list[dict[str, Any]],
        cooldown_seconds: float = 30.0,
    ) -> None:
        self.zones: list[FenceZone] = []
        for z in zones:
            self.zones.append(FenceZone(
                name=z["name"],
                polygon=z["polygon"],
                severity=z.get("severity", "high"),
            ))

        self.cooldown_seconds = cooldown_seconds

        # Debounce state: (track_id, zone_name) → last alert timestamp
        self._last_alert: dict[tuple[int, str], float] = {}

    # ── Core algorithm ───────────────────────────────────────────────────

    @staticmethod
    def is_inside(point: tuple[int, int], polygon: np.ndarray | list) -> bool:
        """
        Test if a point is inside a polygon using OpenCV.

        Returns True if the point is inside or on the boundary.

        Parameters
        ----------
        point : tuple[int, int]
            (x, y) coordinates.
        polygon : np.ndarray or list
            Polygon vertices as [[x1,y1], [x2,y2], ...].
        """
        if not isinstance(polygon, np.ndarray):
            polygon = np.array(polygon, dtype=np.int32)
        result = cv2.pointPolygonTest(
            polygon, (float(point[0]), float(point[1])), False,
        )
        return result >= 0

    def _should_alert(self, key: tuple[int, str], timestamp: float) -> bool:
        """Check if enough time has passed since the last alert for this key."""
        if key not in self._last_alert:
            return True
        elapsed = timestamp - self._last_alert[key]
        return elapsed >= self.cooldown_seconds

    # ── Public API ───────────────────────────────────────────────────────

    def check(
        self,
        tracked_objects: list,
        timestamp: float | None = None,
    ) -> list[FenceEvent]:
        """
        Check all tracked objects against all fence zones.

        Parameters
        ----------
        tracked_objects : list[TrackedObject]
            Objects from ``Tracker.track()``.  Each must have ``.center``,
            ``.track_id``, ``.class_name``, ``.confidence``, ``.bbox_xyxy``.
        timestamp : float, optional
            Current time (seconds).  Defaults to ``time.time()``.

        Returns
        -------
        list[FenceEvent]
            New intrusion alerts (after debouncing).
        """
        if timestamp is None:
            timestamp = time.time()

        events: list[FenceEvent] = []

        for obj in tracked_objects:
            center = obj.center

            for zone in self.zones:
                if self.is_inside(center, zone.np_polygon):
                    key = (obj.track_id, zone.name)

                    if self._should_alert(key, timestamp):
                        events.append(FenceEvent(
                            track_id=obj.track_id,
                            zone_name=zone.name,
                            severity=zone.severity,
                            timestamp=timestamp,
                            class_name=obj.class_name,
                            confidence=obj.confidence,
                            bbox_xyxy=obj.bbox_xyxy,
                            center=center,
                        ))
                        self._last_alert[key] = timestamp

        return events

    def reset(self) -> None:
        """Clear all cooldown state (e.g. when switching videos)."""
        self._last_alert.clear()

    # ── Drawing utility ──────────────────────────────────────────────────

    @staticmethod
    def draw_zones(
        frame: np.ndarray,
        zones: list[FenceZone],
        alpha: float = 0.25,
    ) -> np.ndarray:
        """
        Draw semi-transparent polygon overlays for each zone (returns a copy).

        Zones are colour-coded by severity:
        - low → green, medium → yellow, high → orange, critical → red

        Parameters
        ----------
        frame : np.ndarray
            BGR image.
        zones : list[FenceZone]
            Zones to draw.
        alpha : float
            Opacity of the filled polygon overlay (0-1).
        """
        annotated = frame.copy()
        overlay = frame.copy()

        severity_colors: dict[str, tuple[int, int, int]] = {
            "low":      (0, 200, 0),      # green
            "medium":   (0, 200, 200),     # yellow
            "high":     (0, 100, 255),     # orange
            "critical": (0, 0, 255),       # red
        }

        for zone in zones:
            color = severity_colors.get(zone.severity, (0, 0, 255))
            pts = zone.np_polygon.reshape((-1, 1, 2))

            # Filled polygon on overlay
            cv2.fillPoly(overlay, [zone.np_polygon], color)

            # Border on annotated frame
            cv2.polylines(annotated, [pts], isClosed=True, color=color, thickness=2)

            # Zone label at centroid
            centroid = zone.np_polygon.mean(axis=0).astype(int)
            label = f"{zone.name} [{zone.severity.upper()}]"
            (tw, th), _ = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1,
            )
            cv2.rectangle(
                annotated,
                (centroid[0] - tw // 2 - 2, centroid[1] - th - 4),
                (centroid[0] + tw // 2 + 2, centroid[1] + 4),
                color, -1,
            )
            cv2.putText(
                annotated, label,
                (centroid[0] - tw // 2, centroid[1]),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA,
            )

        # Blend filled overlay with annotated frame
        cv2.addWeighted(overlay, alpha, annotated, 1 - alpha, 0, annotated)

        return annotated
