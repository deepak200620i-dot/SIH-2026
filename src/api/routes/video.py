"""
IBVAP — Video Analytics & Stream Ingestion Routes
==================================================
Handles:
1. Video file upload and offline AI pipeline processing.
2. Real-time webcam / live frame processing for browser surveillance.
"""

from __future__ import annotations

import base64
import gc
import os
import shutil
import tempfile
import time
from typing import Any, Optional

import aiosqlite
import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from src.api.routes.events import ws_manager
from src.db.crud import create_event, update_event_metadata
from src.db.database import get_db
from src.pipeline.video_pipeline import VideoPipeline

router = APIRouter(prefix="/api/video", tags=["video"])

# Global VideoPipeline instance initialized on demand
_pipeline: Optional[VideoPipeline] = None


def _resize_for_processing(frame: np.ndarray, max_dimension: int) -> np.ndarray:
    """Downscale oversized frames while preserving their aspect ratio."""
    height, width = frame.shape[:2]
    largest_dimension = max(width, height)
    if max_dimension <= 0 or largest_dimension <= max_dimension:
        return frame

    scale = max_dimension / largest_dimension
    return cv2.resize(
        frame,
        (max(1, round(width * scale)), max(1, round(height * scale))),
        interpolation=cv2.INTER_AREA,
    )


def get_pipeline() -> VideoPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = VideoPipeline()
    return _pipeline


class FrameProcessRequest(BaseModel):
    image: str  # Base64 data URL or raw base64 string
    camera_id: str = "webcam_01"
    frame_index: int = 0


class DetectedObject(BaseModel):
    track_id: int
    class_name: str
    confidence: float
    bbox: list[float]  # [x1, y1, x2, y2]
    face_name: Optional[str] = None
    is_known_face: Optional[bool] = None
    plate_text: Optional[str] = None


class FrameProcessResponse(BaseModel):
    camera_id: str
    frame_index: int
    fps: float
    total_ms: float
    tracked_objects: list[DetectedObject]
    events_triggered: list[dict[str, Any]]


@router.post("/process-frame", response_model=FrameProcessResponse)
async def process_webcam_frame(
    payload: FrameProcessRequest,
    db: aiosqlite.Connection = Depends(get_db),
) -> FrameProcessResponse:
    """
    Process a single base64 image frame from the browser webcam
    through the IBVAP AI pipeline and persist any triggered security events.
    """
    pipeline = get_pipeline()

    # Decode base64 frame
    try:
        data_str = payload.image
        if "," in data_str:
            data_str = data_str.split(",", 1)[1]
        img_bytes = base64.b64decode(data_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Decoded image is empty")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {str(e)}")

    # Run AI pipeline
    res = pipeline.process_frame(
        frame=frame,
        frame_index=payload.frame_index,
        timestamp=time.time(),
        camera_id=payload.camera_id,
    )

    events_data: list[dict[str, Any]] = []

    # Persist and broadcast any generated events
    for evt in res.generated_events:
        try:
            saved = await create_event(db, evt)
            evt_dict = saved.to_dict()
            events_data.append(evt_dict)
            if evt.event_type == "intrusion" and evt.metadata and evt.metadata.get("session_key"):
                pipeline.register_intrusion_event(evt.metadata["session_key"], saved.id)
            await ws_manager.broadcast(evt_dict)
        except Exception as err:
            print(f"Error persisting frame event: {err}")

    for update in res.completed_intrusions:
        await update_event_metadata(db, update.pop("event_id"), update)

    # Build lookups for face and plate recognitions
    face_by_track = {
        fm.person_track_id: fm for fm in res.face_matches if fm.person_track_id is not None
    }
    plate_by_track = {
        pm.vehicle_track_id: pm for pm in res.plate_matches if pm.vehicle_track_id is not None
    }

    # Format tracked objects
    tracked: list[DetectedObject] = []
    for obj in res.tracked_objects:
        bbox_raw = getattr(obj, "bbox_xyxy", getattr(obj, "bbox", (0, 0, 0, 0)))
        bbox_coords = [float(x) for x in bbox_raw]

        fm = face_by_track.get(obj.track_id)
        pm = plate_by_track.get(obj.track_id)

        tracked.append(
            DetectedObject(
                track_id=obj.track_id,
                class_name=obj.class_name,
                confidence=float(obj.confidence),
                bbox=bbox_coords,
                face_name=fm.name if fm else None,
                is_known_face=fm.is_known if fm else None,
                plate_text=pm.plate_text if pm else None,
            )
        )

    return FrameProcessResponse(
        camera_id=payload.camera_id,
        frame_index=payload.frame_index,
        fps=res.fps,
        total_ms=res.total_ms,
        tracked_objects=tracked,
        events_triggered=events_data,
    )


def warmup_pipeline() -> None:
    """Pre-initialize pipeline models during server startup."""
    try:
        get_pipeline()
    except Exception as e:
        print(f"Pipeline warmup notice: {e}")


@router.post("/upload")
async def upload_and_process_video(
    file: UploadFile = File(...),
    camera_id: str = Form("upload_cam_01"),
    frame_skip: int = Form(5),
    max_frames: int = Form(150),
    db: aiosqlite.Connection = Depends(get_db),
) -> dict[str, Any]:
    """
    Upload a recorded video (.mp4, .avi, .mov), process it frame-by-frame
    through the AI VideoPipeline, save generated events to DB, and broadcast to clients.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No video file provided")

    try:
        pipeline = get_pipeline()
        pipeline.reset()

        # Save uploaded file to a temporary directory
        os.makedirs("data/uploads", exist_ok=True)
        temp_path = os.path.join("data/uploads", f"upload_{int(time.time())}_{file.filename}")

        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Open video with OpenCV
        cap = cv2.VideoCapture(temp_path)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Failed to decode video file. Please use standard MP4/H264 format.")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        processing_cfg = pipeline.config.get("video", {})
        max_processing_dimension = int(processing_cfg.get("max_processing_dimension", 960))

        frame_idx = 0
        processed_count = 0
        total_events_generated = 0
        generated_events_list: list[dict[str, Any]] = []

        start_proc = time.time()

        while cap.isOpened() and processed_count < max_frames:
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            if frame_skip > 1 and (frame_idx % frame_skip != 0):
                del frame
                continue

            processed_count += 1
            current_time = start_proc + (frame_idx / video_fps)
            frame = _resize_for_processing(frame, max_processing_dimension)

            # Process frame
            res = pipeline.process_frame(
                frame=frame,
                frame_index=frame_idx,
                timestamp=current_time,
                camera_id=camera_id,
            )

            # Save and broadcast events
            for evt in res.generated_events:
                total_events_generated += 1
                try:
                    saved = await create_event(db, evt)
                    evt_dict = saved.to_dict()
                    generated_events_list.append(evt_dict)
                    if evt.event_type == "intrusion" and evt.metadata and evt.metadata.get("session_key"):
                        pipeline.register_intrusion_event(evt.metadata["session_key"], saved.id)
                    await ws_manager.broadcast(evt_dict)
                except Exception as e:
                    print(f"Error persisting uploaded video event: {e}")

            for update in res.completed_intrusions:
                await update_event_metadata(db, update.pop("event_id"), update)

            # Pipeline results include an annotated image. Release it before the
            # next high-resolution source frame is decoded.
            del res
            del frame
            if processed_count % 25 == 0:
                gc.collect()

        cap.release()
        elapsed_time = time.time() - start_proc

        return {
            "status": "completed",
            "filename": file.filename,
            "camera_id": camera_id,
            "total_frames": total_frames,
            "processed_frames": processed_count,
            "elapsed_seconds": round(elapsed_time, 2),
            "events_count": total_events_generated,
            "events": generated_events_list[:20],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Video analytics failed: {str(exc)}")
