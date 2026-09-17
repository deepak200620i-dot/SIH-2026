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
from src.detection.weapon_detector import WeaponDetection, WeaponDetector
from src.face.recognizer import FaceMatch, FaceRecognizer
from src.rules.behavior_analytics import BehaviorAnalytics, BehaviorEvent
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
    weapon_detections: list[WeaponDetection] = field(default_factory=list)
    behavior_events: list[BehaviorEvent] = field(default_factory=list)
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

        # 6. Dedicated weapon detector. This is intentionally separate from
        # the COCO people/vehicle model and is inactive without local weights.
        self.weapon_detector = WeaponDetector(self.config.get("weapon_detection", {}))

        # 7. Event Engine
        self.event_engine = EventEngine(self.config)

        # 8. Behavior Analytics (trajectory-based)
        zone_dicts = [{"name": z.get("name", ""), "polygon": z.get("polygon", []), "severity": z.get("severity", "medium")} for z in zones]
        self.behavior_analytics = BehaviorAnalytics(self.config, zones=zone_dicts)

        self._camera_entry_times: dict[tuple[str, int], float] = {}
        self._intrusion_sessions: dict[tuple[str, int, str], dict[str, Any]] = {}
        self._face_sessions: dict[tuple[str, int], dict[str, Any]] = {}

    @staticmethod
    def _identity_id(match: FaceMatch) -> int:
        """Use face re-identification for known faces, or preserve tracked object ID."""
        if match.is_known:
            return zlib.crc32(match.name.encode("utf-8")) % 2_000_000_000
        if match.person_track_id >= 0:
            return match.person_track_id
        if match.unknown_person_id is not None:
            return match.unknown_person_id
        return match.person_track_id

    def register_session_event(self, session_key: str, event_id: int) -> None:
        """Attach a persisted database ID to its active identity session."""
        for session in [*self._intrusion_sessions.values(), *self._face_sessions.values()]:
            if session["session_key"] == session_key:
                session["event_id"] = event_id
                return

    def close_camera_sessions(self, camera_id: str, timestamp: float | None = None) -> list[dict[str, Any]]:
        """Finalize dwell times when a browser/mobile camera explicitly stops."""
        now = timestamp if timestamp is not None else time.time()
        updates: list[dict[str, Any]] = []
        for sessions, duration_key in ((self._face_sessions, "time_under_camera_seconds"), (self._intrusion_sessions, "time_in_zone_seconds")):
            for key, session in list(sessions.items()):
                if key[0] != camera_id:
                    continue
                if session.get("event_id"):
                    updates.append({"event_id": session["event_id"], duration_key: round(max(0, now - session["entry_time"]), 1), "exit_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now))})
                del sessions[key]
        return updates

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

        weapon_detections = self.weapon_detector.detect(frame)

        # 2. Virtual Fence Intrusion
        fence_events = self.fence.check(tracked_objects, timestamp=ts, camera_id=camera_id)

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

        # 5.5 Behavior Analytics (trajectory-based)
        behavior_events = self.behavior_analytics.analyze(tracked_objects, frame_time=ts)

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

        # A weapon is always a critical security event. Associate it with the
        # person whose bounding box contains the weapon centre (with a small
        # margin); an absent or unknown face is explicitly marked unauthorized.
        for weapon in weapon_detections:
            wx, wy = weapon.center
            associated_people = []
            for obj in tracked_objects:
                if obj.class_name != "person":
                    continue
                x1, y1, x2, y2 = obj.bbox_xyxy
                margin_x = max(20, int((x2 - x1) * 0.15))
                margin_y = max(20, int((y2 - y1) * 0.15))
                if x1 - margin_x <= wx <= x2 + margin_x and y1 - margin_y <= wy <= y2 + margin_y:
                    associated_people.append(obj)
            person = min(
                associated_people,
                key=lambda obj: abs(obj.center[0] - wx) + abs(obj.center[1] - wy),
                default=None,
            )
            face = face_by_track.get(person.track_id) if person else None
            unauthorized = face is None or not face.is_known
            weapon_track_id = stable_ids.get(person.track_id, person.track_id) if person else -(weapon.class_id + 1)
            event = self.event_engine.process_event(
                event_type="weapon_detected",
                track_id=weapon_track_id,
                class_name=weapon.class_name,
                face_name=face.name if face and face.is_known else "unknown",
                confidence=weapon.confidence,
                bbox=list(weapon.bbox_xyxy),
                frame=frame,
                camera_id=camera_id,
                timestamp_sec=ts,
                metadata={
                    "weapon_class": weapon.class_name,
                    "weapon_confidence": weapon.confidence,
                    "unauthorized_person": unauthorized,
                    "person_identity": face.display_name if face else "Unauthorized / unverified person",
                    "associated_person_track_id": person.track_id if person else None,
                },
            )
            if event:
                generated_events.append(event)

        active_intrusions: set[tuple[str, int, str]] = set()
        for obj in tracked_objects:
            stable_id = stable_ids.get(obj.track_id, obj.track_id)
            if stable_id < 0:
                continue
            for zone in self.fence.get_zones_for_camera(camera_id):
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

        # Face Events: one record per stable identity for the whole camera session.
        for fm in face_matches:
            # Only trigger if face is recognized or if face_unknown cooldown passes
            event_type = "face_match" if fm.is_known else "face_unknown"
            
            # Use stable unknown_person_id if available to avoid duplicate IDs
            # Prefer ByteTrack's camera-local ID; this is stable while a person
            # remains in the feed and prevents repeated unknown-face records.
            tid = self._identity_id(fm)
            if tid is None or tid < 0:
                continue
            face_key = (camera_id, tid)
            existing_face_session = self._face_sessions.get(face_key)
            if existing_face_session:
                existing_face_session["last_seen"] = ts
                continue
            session_key = f"face:{camera_id}:{tid}"

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
                    "session_key": session_key,
                    "entry_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts)),
                    "time_under_camera_seconds": None,
                    "person_identity": fm.display_name,
                },
            )
            if evt:
                generated_events.append(evt)
                self._face_sessions[face_key] = {"session_key": session_key, "entry_time": ts, "last_seen": ts, "event_id": None}

        # A face session closes after a short absence, so the saved duration is
        # the time physically observed by this camera—not wall-clock time later.
        active_face_keys = {(camera_id, self._identity_id(fm)) for fm in face_matches if self._identity_id(fm) >= 0}
        for key, session in list(self._face_sessions.items()):
            if key not in active_face_keys and ts - session["last_seen"] >= 2.0:
                if session.get("event_id"):
                    completed_intrusions.append({
                        "event_id": session["event_id"],
                        "time_under_camera_seconds": round(session["last_seen"] - session["entry_time"], 1),
                        "exit_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(session["last_seen"])),
                    })
                del self._face_sessions[key]

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

        # Behavior Analytics Events
        for be in behavior_events:
            evt = self.event_engine.process_event(
                event_type=be.event_type,
                track_id=be.track_id,
                class_name=be.class_name,
                zone_name=be.zone_name,
                zone_severity=be.severity,
                confidence=be.confidence,
                bbox=be.bbox_xyxy,
                frame=frame,
                camera_id=camera_id,
                timestamp_sec=ts,
                metadata=be.metadata,
            )
            if evt:
                generated_events.append(evt)

        # 7. Draw Visual Annotations
        annotated = frame.copy()
        annotated = VirtualFence.draw_zones(annotated, self.fence.zones, camera_id=camera_id)
        annotated = Tracker.draw_tracks(annotated, tracked_objects)

        if weapon_detections:
            annotated = WeaponDetector.draw_detections(annotated, weapon_detections)

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
            weapon_detections=weapon_detections,
            behavior_events=behavior_events,
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
        zone_dicts = [{"name": z.get("name", ""), "polygon": z.get("polygon", []), "severity": z.get("severity", "medium")} for z in zones]
        self.behavior_analytics.update_zones(zone_dicts)

    def reset(self) -> None:
        """Reset internal pipeline states."""
        self.tracker.reset()
        self.fence.reset()
        self.loitering.reset()
        self.event_engine.reset()
        self.behavior_analytics.reset()
        self._camera_entry_times.clear()
        self._intrusion_sessions.clear()
        self._face_sessions.clear()
        if self.face_recognizer:
            self.face_recognizer.reset()
        if self.plate_reader:
            self.plate_reader.reset()
