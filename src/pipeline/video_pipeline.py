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

        # Intrusion Events
        for fe in fence_events:
            evt = self.event_engine.process_event(
                event_type="intrusion",
                track_id=fe.track_id,
                class_name=fe.class_name,
                zone_name=fe.zone_name,
                zone_severity=fe.severity,
                confidence=fe.confidence,
                bbox=list(fe.bbox_xyxy),
                frame=frame,
                camera_id=camera_id,
                timestamp_sec=ts,
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
            tid = fm.unknown_person_id if fm.unknown_person_id is not None else fm.person_track_id

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
        if self.face_recognizer:
            self.face_recognizer.reset()
