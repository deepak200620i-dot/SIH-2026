"""
IBVAP — Unified Video Analytics Pipeline
=========================================
Orchestrates object tracking, virtual fence intrusion, loitering detection,
face recognition, ANPR plate reading, and event persistence engine.

Usage:
    from src.pipeline.video_pipeline import VideoPipeline
    pipeline = VideoPipeline(config)
    result = pipeline.process_frame(frame, frame_index=1)
"""

from __future__ import annotations

import os
import time
import zlib
from dataclasses import dataclass, field
from typing import Any, Optional

import cv2
import numpy as np
import yaml

from src.anpr.plate_reader import PlateMatch, PlateReader
from src.face.recognizer import FaceMatch, FaceRecognizer
from src.rules.event_engine import Event, EventEngine
from src.rules.loitering import LoiteringDetector, LoiteringEvent
from src.rules.virtual_fence import FenceEvent, VirtualFence
from src.tracking.tracker import TrackedObject, Tracker


@dataclass
class PipelineFrameResult:
    """Aggregated detection, tracking, rules, and alert result for a single frame."""

    frame_index: int
    timestamp: float
    tracked_objects: list[TrackedObject] = field(default_factory=list)
    fence_events: list[FenceEvent] = field(default_factory=list)
    loitering_events: list[LoiteringEvent] = field(default_factory=list)
    face_matches: list[FaceMatch] = field(default_factory=list)
    plate_matches: list[PlateMatch] = field(default_factory=list)
    generated_events: list[Event] = field(default_factory=list)
    completed_intrusions: list[dict[str, Any]] = field(default_factory=list)
    annotated_frame: Optional[np.ndarray] = None
    fps: float = 0.0
    total_ms: float = 0.0


class VideoPipeline:
    """
    Main orchestrator for IBVAP video analytics layer.
    """

    def __init__(
        self,
        config: dict[str, Any] | None = None,
        config_path: str = "config/settings.yaml",
        enable_face: bool = True,
        enable_anpr: bool = True,
    ) -> None:
        if config is None and os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f) or {}

        self.config = config or {}
        self.enable_face = enable_face
        self.enable_anpr = enable_anpr

        # 1. Object Tracker
        self.tracker = Tracker(self.config)

        # 2. Virtual Fence
        fence_cfg = self.config.get("fence", {})
        zones = fence_cfg.get("zones", [])
        cooldown = fence_cfg.get("cooldown_seconds", 30.0)
        self.fence = VirtualFence(zones=zones, cooldown_seconds=cooldown)

        # 3. Loitering Detector
        loitering_cfg = self.config.get("loitering", {})
        l_threshold = loitering_cfg.get("threshold_seconds", 60.0)
        l_cooldown = loitering_cfg.get("cooldown_seconds", 30.0)
        self.loitering = LoiteringDetector(
            zones=zones, threshold_seconds=l_threshold, cooldown_seconds=l_cooldown
        )

        # 4. Face Recognizer
        self.face_recognizer: Optional[FaceRecognizer] = None
        if self.enable_face:
            self.face_recognizer = FaceRecognizer(self.config)

        # 5. ANPR Plate Reader
        self.plate_reader: Optional[PlateReader] = None
        if self.enable_anpr:
            self.plate_reader = PlateReader(self.config)

        # 6. Event Engine
        self.event_engine = EventEngine(self.config)
        self._camera_entry_times: dict[tuple[str, int], float] = {}
        self._intrusion_sessions: dict[tuple[str, int, str], dict[str, Any]] = {}

    @staticmethod
    def _identity_id(match: FaceMatch) -> int:
        """Use face re-identification, not a volatile tracker number, as identity."""
        if not match.is_known and match.unknown_person_id is not None:
            return match.unknown_person_id
        if match.is_known:
            return zlib.crc32(match.name.encode("utf-8")) % 2_000_000_000
        return match.person_track_id

    def register_intrusion_event(self, session_key: str, event_id: int) -> None:
        """Attach the persisted database ID to its active intrusion session."""
        for session in self._intrusion_sessions.values():
            if session["session_key"] == session_key:
                session["event_id"] = event_id
                return

    def process_frame(
        self,
        frame: np.ndarray,
        frame_index: int = 0,
        timestamp: float | None = None,
        camera_id: str = "cam_01",
    ) -> PipelineFrameResult:
        """
        Process a single video frame through all pipeline stages.
        """
        start_time = time.time()
        ts = timestamp if timestamp is not None else start_time

        # 1. Tracking
        tracking_res = self.tracker.track(frame, frame_index=frame_index)
        tracked_objects = tracking_res.tracked_objects

        # 2. Virtual Fence Intrusion
        fence_events = self.fence.check(tracked_objects, timestamp=ts)

        # 3. Loitering Detection
        loitering_events = self.loitering.check(tracked_objects, timestamp=ts)

        # 4. Face Recognition (Persons only)
        face_matches: list[FaceMatch] = []
        if self.enable_face and self.face_recognizer:
            face_matches = self.face_recognizer.recognize_frame(frame, tracked_objects)

        # 5. ANPR Plate Reading (Vehicles only)
        plate_matches: list[PlateMatch] = []
        if self.enable_anpr and self.plate_reader:
            plate_matches = self.plate_reader.read_frame(frame, tracked_objects)

        # 6. Event Processing & Persisting
        generated_events: list[Event] = []

        active_camera_tracks = {(camera_id, obj.track_id) for obj in tracked_objects if obj.track_id >= 0}
        self._camera_entry_times = {key: entered for key, entered in self._camera_entry_times.items() if key in active_camera_tracks}
        for obj in tracked_objects:
            if obj.track_id >= 0:
                self._camera_entry_times.setdefault((camera_id, obj.track_id), ts)

        # Face re-identification provides a stable identity even when ByteTrack
        # loses/reassigns a numeric ID during the same camera session.
        face_by_track = {fm.person_track_id: fm for fm in face_matches}
        stable_ids = {
            obj.track_id: self._identity_id(face_by_track[obj.track_id])
            for obj in tracked_objects if obj.track_id in face_by_track
        }

        active_intrusions: set[tuple[str, int, str]] = set()
        for obj in tracked_objects:
            stable_id = stable_ids.get(obj.track_id, obj.track_id)
            if stable_id < 0:
                continue
            for zone in self.fence.zones:
                if VirtualFence.is_inside(obj.center, zone.np_polygon):
                    key = (camera_id, stable_id, zone.name)
                    active_intrusions.add(key)
                    session = self._intrusion_sessions.get(key)
                    if session:
                        session["last_seen"] = ts

        completed_intrusions: list[dict[str, Any]] = []
        for key, session in list(self._intrusion_sessions.items()):
            if key not in active_intrusions and ts - session["last_seen"] >= 2.0:
                if session.get("event_id"):
                    completed_intrusions.append({
                        "event_id": session["event_id"],
                        "time_in_zone_seconds": round(session["last_seen"] - session["entry_time"], 1),
                        "exit_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(session["last_seen"])),
                    })
                del self._intrusion_sessions[key]

        # Intrusion Events
        for fe in fence_events:
            stable_id = stable_ids.get(fe.track_id, fe.track_id)
            session_key = f"{camera_id}:{stable_id}:{fe.zone_name}"
            key = (camera_id, stable_id, fe.zone_name)
            if key in self._intrusion_sessions:
                continue
            identity = face_by_track.get(fe.track_id)
            self._intrusion_sessions[key] = {
                "session_key": session_key, "entry_time": ts, "last_seen": ts, "event_id": None,
            }
            evt = self.event_engine.process_event(
                event_type="intrusion",
                track_id=stable_id,
                class_name=fe.class_name,
                zone_name=fe.zone_name,
                zone_severity=fe.severity,
                confidence=fe.confidence,
                bbox=list(fe.bbox_xyxy),
                frame=frame,
                camera_id=camera_id,
                timestamp_sec=ts,
                metadata={"session_key": session_key, "entry_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts)), "time_in_zone_seconds": None, "person_identity": identity.display_name if identity else f"Person #{stable_id}"},
            )
            if evt:
                generated_events.append(evt)

        # Loitering Events
        for le in loitering_events:
            evt = self.event_engine.process_event(
                event_type="loitering",
                track_id=le.track_id,
                class_name=le.class_name,
                zone_name=le.zone_name,
                zone_severity=le.severity,
                confidence=le.confidence,
                bbox=list(le.bbox_xyxy),
                frame=frame,
                camera_id=camera_id,
                timestamp_sec=ts,
                metadata={"dwell_time_seconds": le.dwell_time_seconds},
            )
            if evt:
                generated_events.append(evt)

        # Face Events (Debounced per person ID)
        for fm in face_matches:
            # Only trigger if face is recognized or if face_unknown cooldown passes
            event_type = "face_match" if fm.is_known else "face_unknown"
            
            # Use stable unknown_person_id if available to avoid duplicate IDs
            # Prefer ByteTrack's camera-local ID; this is stable while a person
            # remains in the feed and prevents repeated unknown-face records.
            tid = self._identity_id(fm)
            entry_time = self._camera_entry_times.get((camera_id, tid), ts) if tid is not None else ts

            # If there are restricted zones on this camera, check if person is in a zone
            in_restricted_zone = any(
                VirtualFence.is_inside(fm.face_center, z.np_polygon) for z in self.fence.zones
            ) if self.fence.zones else False

            # Unknown face is an active security alert if inside restricted zone or on restricted feeds
            severity_override = "high" if in_restricted_zone else "low"

            evt = self.event_engine.process_event(
                event_type=event_type,
                track_id=tid,
                class_name="person",
                face_name=fm.name,
                zone_severity=severity_override,
                confidence=fm.confidence,
                bbox=list(fm.face_bbox),
                frame=frame,
                camera_id=camera_id,
                timestamp_sec=ts,
                metadata={
                    "entry_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(entry_time)),
                    "time_under_camera_seconds": round(ts - entry_time, 1),
                    "person_identity": fm.display_name,
                },
            )
            if evt:
                generated_events.append(evt)

        # ANPR Events
        for pm in plate_matches:
            evt = self.event_engine.process_event(
                event_type="anpr",
                track_id=pm.vehicle_track_id,
                class_name=pm.class_name,
                plate_text=pm.plate_text,
                confidence=pm.confidence,
                bbox=list(pm.vehicle_bbox),
                frame=frame,
                camera_id=camera_id,
                timestamp_sec=ts,
            )
            if evt:
                generated_events.append(evt)

        # Entity Detection for uploaded recorded video evaluation (informational log only, low severity)
        if camera_id.startswith("upload_") and not generated_events:
            for obj in tracked_objects:
                is_person = obj.class_name == "person"
                is_vehicle = obj.class_name in ("car", "truck", "bus", "motorcycle")
                if is_person or is_vehicle:
                    evt_type = "person_detected" if is_person else "vehicle_detected"
                    evt = self.event_engine.process_event(
                        event_type=evt_type,
                        track_id=obj.track_id,
                        class_name=obj.class_name,
                        zone_severity="low",
                        confidence=obj.confidence,
                        bbox=list(obj.bbox_xyxy),
                        frame=frame,
                        camera_id=camera_id,
                        timestamp_sec=ts,
                    )
                    if evt:
                        generated_events.append(evt)
                        break

        # 7. Draw Visual Annotations
        annotated = frame.copy()
        annotated = VirtualFence.draw_zones(annotated, self.fence.zones)
        annotated = Tracker.draw_tracks(annotated, tracked_objects)

        if face_matches and self.face_recognizer:
            annotated = FaceRecognizer.draw_face_matches(annotated, face_matches)

        if plate_matches and self.plate_reader:
            annotated = PlateReader.draw_plate_matches(annotated, plate_matches)

        total_ms = (time.time() - start_time) * 1000.0
        fps = 1000.0 / total_ms if total_ms > 0 else 0.0

        return PipelineFrameResult(
            frame_index=frame_index,
            timestamp=ts,
            tracked_objects=tracked_objects,
            fence_events=fence_events,
            loitering_events=loitering_events,
            face_matches=face_matches,
            plate_matches=plate_matches,
            generated_events=generated_events,
            completed_intrusions=completed_intrusions,
            annotated_frame=annotated,
            fps=fps,
            total_ms=total_ms,
        )

    def update_zones(self, zones: list[dict[str, Any]]) -> None:
        """Dynamically update virtual fence zones and loitering detector."""
        self.fence.update_zones(zones)
        self.loitering.zones = self.fence.zones

    def reset(self) -> None:
        """Reset internal pipeline states."""
        self.tracker.reset()
        self.fence.reset()
        self.loitering.reset()
        self.event_engine.reset()
        self._camera_entry_times.clear()
        self._intrusion_sessions.clear()
        if self.face_recognizer:
            self.face_recognizer.reset()
