"""
IBVAP — Trajectory-Based Behavior Analytics
=============================================
Rule-based behavior analysis consuming ByteTrack trajectory data.
NOT deep learning — purely geometric / temporal rule engine.

Supported behaviors:
  - Direction violation (configurable permitted direction per zone)
  - Repeated zone entry (track re-entering the same zone multiple times)
  - Crowding (too many persons in a zone simultaneously)
  - Rapid movement (abnormally high pixel displacement / time)
  - Abnormal dwell (excessive dwell beyond loitering threshold)
"""

from __future__ import annotations

import math
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Optional

import cv2
import numpy as np


@dataclass
class BehaviorEvent:
    """A behavioral anomaly detected from trajectory analysis."""
    event_type: str          # e.g., "direction_violation", "crowding"
    severity: str            # low / medium / high / critical
    track_id: int
    zone_name: Optional[str] = None
    class_name: Optional[str] = None
    confidence: float = 0.9
    bbox_xyxy: Optional[list[float]] = None
    center: Optional[tuple[float, float]] = None
    metadata: Optional[dict[str, Any]] = None
    timestamp: Optional[float] = None


class BehaviorAnalytics:
    """
    Rule-based behavior analytics engine.

    Consumes tracked object positions each frame and detects anomalous
    patterns based on configurable thresholds.

    Parameters
    ----------
    config : dict
        ``behavior_analytics`` section from ``settings.yaml``.
    zones : list[dict]
        List of zone definitions with ``name``, ``polygon``, ``severity``.
    """

    def __init__(self, config: dict, zones: list[dict] | None = None):
        ba = config.get("behavior_analytics", {})

        # Direction violation
        self.direction_enabled = ba.get("direction_enabled", True)
        self.min_displacement = ba.get("min_displacement_px", 30)
        self.angle_tolerance = ba.get("angle_tolerance_deg", 45)
        self.zone_directions: dict[str, float] = ba.get("zone_permitted_directions", {})
        # e.g., {"restricted_area_1": 90}  # degrees from +x axis

        # Repeated entry
        self.repeated_entry_enabled = ba.get("repeated_entry_enabled", True)
        self.max_entries = ba.get("max_entries", 3)
        self.entry_window_seconds = ba.get("entry_window_minutes", 30) * 60

        # Crowding
        self.crowding_enabled = ba.get("crowding_enabled", True)
        self.max_persons_per_zone = ba.get("max_persons_per_zone", 5)

        # Rapid movement
        self.rapid_movement_enabled = ba.get("rapid_movement_enabled", True)
        self.max_speed_px_per_sec = ba.get("max_speed_px_per_sec", 200)

        # Abnormal dwell
        self.abnormal_dwell_enabled = ba.get("abnormal_dwell_enabled", True)
        self.excessive_dwell_multiplier = ba.get("excessive_dwell_multiplier", 3.0)
        self.base_dwell_seconds = ba.get("base_dwell_seconds", 60)

        # Cooldowns (prevent alert floods)
        self.cooldown_seconds = ba.get("cooldown_seconds", 30.0)

        # Zones
        self.zones = zones or []

        # Internal state
        self._trajectory: dict[int, list[tuple[float, float, float]]] = defaultdict(list)
        # track_id → [(x, y, timestamp), ...]
        self._entry_log: dict[str, list[float]] = defaultdict(list)
        # "track_id:zone_name" → [entry_timestamps]
        self._cooldowns: dict[str, float] = {}
        # "event_type:track_id:zone_name" → last_alert_timestamp
        self._zone_occupancy: dict[str, set[int]] = defaultdict(set)
        # zone_name → set of track_ids currently inside

    def update_zones(self, zones: list[dict]) -> None:
        """Hot-reload zone definitions."""
        self.zones = zones

    def _is_inside(self, point: tuple[float, float], polygon: list[list[int]]) -> bool:
        """Check if a point is inside a polygon. Delegates to VirtualFence."""
        if len(polygon) < 3:
            return False
        from src.rules.virtual_fence import VirtualFence
        return VirtualFence.is_inside((int(point[0]), int(point[1])), polygon)

    def _check_cooldown(self, key: str, now: float) -> bool:
        """Return True if cooldown has expired (i.e., OK to fire)."""
        last = self._cooldowns.get(key, 0)
        if now - last < self.cooldown_seconds:
            return False
        self._cooldowns[key] = now
        return True

    def analyze(
        self,
        tracked_objects: list,
        frame_time: float | None = None,
    ) -> list[BehaviorEvent]:
        """
        Analyze current frame's tracked objects for behavioral anomalies.

        Parameters
        ----------
        tracked_objects : list
            Objects from ByteTrack with ``track_id``, ``center``, ``class_name``,
            ``bbox_xyxy``, ``confidence`` attributes.
        frame_time : float
            Current timestamp (epoch seconds). Defaults to time.time().

        Returns
        -------
        list[BehaviorEvent]
            Detected behavioral anomalies this frame.
        """
        now = frame_time or time.time()
        events: list[BehaviorEvent] = []

        # Update trajectories
        for obj in tracked_objects:
            tid = getattr(obj, "track_id", -1)
            if tid < 0:
                continue

            cx, cy = getattr(obj, "center", (0, 0))
            self._trajectory[tid].append((cx, cy, now))

            # Keep only last 5 minutes of trajectory
            cutoff = now - 300
            self._trajectory[tid] = [
                p for p in self._trajectory[tid] if p[2] > cutoff
            ]

        # ── Per-zone analysis ──────────────────────────────────────────
        # Reset zone occupancy for this frame
        current_occupancy: dict[str, set[int]] = defaultdict(set)

        for zone in self.zones:
            z_name = zone.get("name", "")
            polygon = zone.get("polygon", [])
            z_severity = zone.get("severity", "medium")

            if len(polygon) < 3:
                continue

            for obj in tracked_objects:
                tid = getattr(obj, "track_id", -1)
                if tid < 0:
                    continue

                cls = getattr(obj, "class_name", "object")
                cx, cy = getattr(obj, "center", (0, 0))
                bbox = getattr(obj, "bbox_xyxy", None)
                bbox_list = list(bbox) if bbox is not None else None
                conf = getattr(obj, "confidence", 0.9)

                inside = self._is_inside((cx, cy), polygon)

                if inside and cls == "person":
                    current_occupancy[z_name].add(tid)

                # ─ Direction Violation ─────────────────────────────────
                if (
                    self.direction_enabled
                    and inside
                    and z_name in self.zone_directions
                ):
                    traj = self._trajectory.get(tid, [])
                    if len(traj) >= 2:
                        x0, y0, _ = traj[-2]
                        x1, y1, _ = traj[-1]
                        dx = x1 - x0
                        dy = y1 - y0
                        displacement = math.hypot(dx, dy)
                        if displacement >= self.min_displacement:
                            angle = math.degrees(math.atan2(-dy, dx)) % 360
                            permitted = self.zone_directions[z_name]
                            diff = abs(angle - permitted)
                            diff = min(diff, 360 - diff)
                            if diff > self.angle_tolerance:
                                key = f"direction:{tid}:{z_name}"
                                if self._check_cooldown(key, now):
                                    events.append(BehaviorEvent(
                                        event_type="direction_violation",
                                        severity="high",
                                        track_id=tid,
                                        zone_name=z_name,
                                        class_name=cls,
                                        confidence=conf,
                                        bbox_xyxy=bbox_list,
                                        center=(cx, cy),
                                        metadata={
                                            "actual_direction_deg": round(angle, 1),
                                            "permitted_direction_deg": permitted,
                                            "deviation_deg": round(diff, 1),
                                        },
                                        timestamp=now,
                                    ))

                # ─ Repeated Entry ──────────────────────────────────────
                if self.repeated_entry_enabled and inside:
                    entry_key = f"{tid}:{z_name}"
                    was_inside = tid in self._zone_occupancy.get(z_name, set())
                    if not was_inside:
                        # New entry
                        self._entry_log[entry_key].append(now)
                        # Clean old entries outside window
                        cutoff = now - self.entry_window_seconds
                        self._entry_log[entry_key] = [
                            t for t in self._entry_log[entry_key] if t > cutoff
                        ]
                        if len(self._entry_log[entry_key]) > self.max_entries:
                            key = f"repeated_entry:{tid}:{z_name}"
                            if self._check_cooldown(key, now):
                                events.append(BehaviorEvent(
                                    event_type="repeated_zone_entry",
                                    severity="high",
                                    track_id=tid,
                                    zone_name=z_name,
                                    class_name=cls,
                                    confidence=conf,
                                    bbox_xyxy=bbox_list,
                                    center=(cx, cy),
                                    metadata={
                                        "entry_count": len(self._entry_log[entry_key]),
                                        "window_minutes": self.entry_window_seconds / 60,
                                        "max_allowed": self.max_entries,
                                    },
                                    timestamp=now,
                                ))

        # ── Crowding (zone-level) ──────────────────────────────────────
        if self.crowding_enabled:
            for z_name, occupants in current_occupancy.items():
                if len(occupants) > self.max_persons_per_zone:
                    key = f"crowding:zone:{z_name}"
                    if self._check_cooldown(key, now):
                        events.append(BehaviorEvent(
                            event_type="crowding",
                            severity="high",
                            track_id=min(occupants),  # representative track
                            zone_name=z_name,
                            class_name="person",
                            confidence=0.95,
                            metadata={
                                "person_count": len(occupants),
                                "max_allowed": self.max_persons_per_zone,
                                "track_ids": sorted(occupants),
                            },
                            timestamp=now,
                        ))

        # Update zone occupancy for next frame
        self._zone_occupancy = current_occupancy

        # ── Per-track analysis (no zone needed) ────────────────────────
        for obj in tracked_objects:
            tid = getattr(obj, "track_id", -1)
            if tid < 0:
                continue

            cls = getattr(obj, "class_name", "object")
            cx, cy = getattr(obj, "center", (0, 0))
            bbox = getattr(obj, "bbox_xyxy", None)
            bbox_list = list(bbox) if bbox is not None else None
            conf = getattr(obj, "confidence", 0.9)

            traj = self._trajectory.get(tid, [])

            # ─ Rapid Movement ─────────────────────────────────────────
            if self.rapid_movement_enabled and len(traj) >= 2:
                x0, y0, t0 = traj[-2]
                x1, y1, t1 = traj[-1]
                dt = t1 - t0
                if dt > 0:
                    speed = math.hypot(x1 - x0, y1 - y0) / dt
                    if speed > self.max_speed_px_per_sec:
                        key = f"rapid:{tid}"
                        if self._check_cooldown(key, now):
                            events.append(BehaviorEvent(
                                event_type="rapid_movement",
                                severity="medium",
                                track_id=tid,
                                class_name=cls,
                                confidence=conf,
                                bbox_xyxy=bbox_list,
                                center=(cx, cy),
                                metadata={
                                    "speed_px_per_sec": round(speed, 1),
                                    "threshold": self.max_speed_px_per_sec,
                                },
                                timestamp=now,
                            ))

            # ─ Abnormal Dwell ─────────────────────────────────────────
            if self.abnormal_dwell_enabled and len(traj) >= 2:
                first_time = traj[0][2]
                dwell = now - first_time
                threshold = self.base_dwell_seconds * self.excessive_dwell_multiplier
                if dwell > threshold:
                    key = f"abnormal_dwell:{tid}"
                    if self._check_cooldown(key, now):
                        events.append(BehaviorEvent(
                            event_type="abnormal_dwell",
                            severity="critical",
                            track_id=tid,
                            class_name=cls,
                            confidence=conf,
                            bbox_xyxy=bbox_list,
                            center=(cx, cy),
                            metadata={
                                "dwell_seconds": round(dwell, 1),
                                "threshold_seconds": threshold,
                            },
                            timestamp=now,
                        ))

        return events

    def reset(self) -> None:
        """Clear all internal state."""
        self._trajectory.clear()
        self._entry_log.clear()
        self._cooldowns.clear()
        self._zone_occupancy.clear()
