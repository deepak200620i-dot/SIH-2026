"""
IBVAP — Event Engine
===================
Severity scoring, deduplication, cooldown, and evidence snapshot capturing.
Converts pipeline alerts (FenceEvent, FaceMatch, ANPR) into persistent Event dataclasses.

Usage:
    from src.rules.event_engine import EventEngine, Event
    engine = EventEngine(config)
    event = engine.process_event(
        event_type="intrusion",
        track_id=1,
        class_name="person",
        zone_name="restricted_area_1",
        zone_severity="high",
        frame=current_frame,
    )
"""

from __future__ import annotations

import os
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np


@dataclass
class Event:
    """Standard event model for IBVAP system."""

    timestamp: str                         # ISO 8601 string
    event_type: str                        # 'intrusion', 'face_match', 'face_unknown', 'anpr', 'loitering'
    severity: str                          # 'low', 'medium', 'high', 'critical'
    camera_id: str = "cam_01"
    track_id: Optional[int] = None
    class_name: Optional[str] = None
    zone_name: Optional[str] = None
    face_name: Optional[str] = None
    plate_text: Optional[str] = None
    confidence: Optional[float] = None
    bbox: Optional[list[float]] = None     # [x1, y1, x2, y2]
    snapshot: Optional[str] = None         # path to snapshot file
    metadata: Optional[dict[str, Any]] = None
    status: str = "ACTIVE"
    id: Optional[int] = None
    created_at: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        """Convert event dataclass to dictionary."""
        return asdict(self)


class EventEngine:
    """
    Central Event Engine for IBVAP.

    Processes alerts from pipeline components, computes severity,
    enforces deduplication/cooldown, and saves evidence snapshot frames.
    """

    SEVERITY_ORDER = {"low": 1, "medium": 2, "high": 3, "critical": 4}

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        cfg = config or {}
        events_cfg = cfg.get("events", {})
        self.cooldown_seconds: float = float(events_cfg.get("cooldown_seconds", 30.0))
        self.evidence_path: str = events_cfg.get("evidence_path", "data/evidence")

        # Debounce state is scoped to the camera as track IDs are camera-local.
        self._last_event: dict[tuple[str, Optional[int], str, Optional[str]], float] = {}

    def calculate_severity(
        self,
        event_type: str,
        zone_severity: str | None = None,
        is_known: bool | None = None,
    ) -> str:
        """
        Calculate event severity based on event type and attributes.
        """
        if event_type == "intrusion":
            if zone_severity:
                return zone_severity.lower()
            return "high"
        elif event_type == "face_unknown":
            return "high"
        elif event_type == "face_match":
            if is_known is False:
                return "high"
            return "low"
        elif event_type == "anpr":
            return "medium"
        elif event_type == "loitering":
            return "high"
        elif event_type in ("person_detected", "person"):
            return "medium"
        elif event_type in ("vehicle_detected", "vehicle"):
            return "low"

        return "medium"

    def should_process(
        self,
        track_id: int | None,
        event_type: str,
        zone_name: str | None = None,
        timestamp: float | None = None,
        camera_id: str = "cam_01",
    ) -> bool:
        """
        Check if event passes deduplication / cooldown checks.
        """
        if timestamp is None:
            timestamp = time.time()

        key = (camera_id, track_id, event_type, zone_name)
        # A recognised identity is a single observation per camera session,
        # rather than a new event for every frame in which a face is detected.
        cooldown = 300.0 if "face" in event_type else self.cooldown_seconds
        if key in self._last_event:
            elapsed = timestamp - self._last_event[key]
            if elapsed < cooldown:
                return False

        self._last_event[key] = timestamp
        return True

    def save_snapshot(
        self,
        frame: np.ndarray | None,
        event_type: str,
        timestamp_dt: datetime | None = None,
        bbox: list[float] | tuple | None = None,
        label: str | None = None,
    ) -> str | None:
        """
        Save annotated evidence snapshot frame to disk.
        Returns relative file path string or None if frame is invalid.
        """
        if frame is None:
            return None

        if timestamp_dt is None:
            timestamp_dt = datetime.now(timezone.utc)

        os.makedirs(self.evidence_path, exist_ok=True)

        timestr = timestamp_dt.strftime("%Y%m%d_%H%M%S_%f")
        filename = f"{timestr}_{event_type}.jpg"
        filepath = os.path.join(self.evidence_path, filename)

        annotated = frame.copy()
        if bbox is not None and len(bbox) == 4:
            x1, y1, x2, y2 = map(int, bbox)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 2)
            if label:
                cv2.putText(
                    annotated,
                    label,
                    (x1, max(15, y1 - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 0, 255),
                    1,
                    cv2.LINE_AA,
                )

        success = cv2.imwrite(filepath, annotated)
        if success:
            return Path(filepath).as_posix()
        return None

    def process_event(
        self,
        event_type: str,
        track_id: int | None = None,
        class_name: str | None = None,
        zone_name: str | None = None,
        zone_severity: str | None = None,
        face_name: str | None = None,
        plate_text: str | None = None,
        confidence: float | None = None,
        bbox: list[float] | tuple | None = None,
        frame: np.ndarray | None = None,
        camera_id: str = "cam_01",
        timestamp_sec: float | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Event | None:
        """
        Process incoming alert, check cooldown, compute severity, save snapshot, and return Event.
        """
        now_dt = datetime.now(timezone.utc)
        ts_sec = timestamp_sec if timestamp_sec is not None else now_dt.timestamp()

        if not self.should_process(track_id, event_type, zone_name, ts_sec, camera_id):
            return None

        is_known = (
            (face_name is not None and face_name != "unknown")
            if event_type in ("face_match", "face_unknown")
            else None
        )
        severity = self.calculate_severity(
            event_type, zone_severity=zone_severity, is_known=is_known
        )

        label = f"{event_type.upper()}"
        if class_name:
            label += f" ({class_name})"
        if face_name:
            label += f": {face_name}"
        if plate_text:
            label += f": {plate_text}"
        if metadata and metadata.get("entry_time"):
            label += f" | Entry {metadata['entry_time']}"

        bbox_list = list(bbox) if bbox is not None else None
        snapshot_path = self.save_snapshot(
            frame, event_type, now_dt, bbox=bbox_list, label=label
        )

        return Event(
            timestamp=now_dt.isoformat(),
            event_type=event_type,
            severity=severity,
            camera_id=camera_id,
            track_id=track_id,
            class_name=class_name,
            zone_name=zone_name,
            face_name=face_name,
            plate_text=plate_text,
            confidence=confidence,
            bbox=bbox_list,
            snapshot=snapshot_path,
            metadata=metadata,
        )

    def reset(self) -> None:
        """Clear all deduplication cooldown states."""
        self._last_event.clear()
