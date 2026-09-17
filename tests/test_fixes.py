import os, sys
sys.path.insert(0, r"c:\Users\ridha\Downloads\SIH-2026")
import pytest
import numpy as np
from src.rules.virtual_fence import VirtualFence, FenceZone
from src.face.recognizer import FaceRecognizer
from src.anpr.plate_reader import PlateReader
from src.tracking.tracker import TrackedObject

def test_virtual_fence_camera_scoping():
    zones = [
        {"name": "webcam_zone", "polygon": [[0, 0], [100, 0], [100, 100], [0, 100]], "severity": "critical", "camera_id": "device_webcam"},
        {"name": "all_zone", "polygon": [[200, 200], [300, 200], [300, 300], [200, 300]], "severity": "high", "camera_id": "all"},
    ]
    fence = VirtualFence(zones=zones, cooldown_seconds=1.0)
    obj_in_webcam = TrackedObject(bbox_xyxy=(10, 10, 50, 50), confidence=0.9, class_id=0, class_name="person", track_id=1)

    # When tested against upload_feed, webcam_zone should NOT fire
    events_upload = fence.check([obj_in_webcam], timestamp=100.0, camera_id="upload_feed")
    assert len(events_upload) == 0

    # When tested against device_webcam, webcam_zone SHOULD fire
    events_webcam = fence.check([obj_in_webcam], timestamp=100.0, camera_id="device_webcam")
    assert len(events_webcam) == 1
    assert events_webcam[0].zone_name == "webcam_zone"

def test_anpr_positional_correction():
    # Test OCR correction for Indian 10-char plate
    raw_10 = "MHI2ABIZ34"
    corrected_10 = PlateReader.correct_plate_format(raw_10)
    assert corrected_10 == "MH12AB1234"
    assert PlateReader.is_valid_plate(corrected_10)

    # Test OCR correction for Indian 9-char plate
    raw_9 = "DLOICIZ34"
    corrected_9 = PlateReader.correct_plate_format(raw_9)
    assert corrected_9 == "DL01C1234"
    assert PlateReader.is_valid_plate(corrected_9)

def test_face_recognizer_track_binding():
    dummy_cfg = {"face": {"gallery_path": "data/faces", "similarity_threshold": 0.6}}
    recognizer = FaceRecognizer(dummy_cfg)
    recognizer.reset()

    # Two slightly different embeddings (e.g. turning head) for person_track_id=1
    rng = np.random.RandomState(42)
    base_emb = rng.randn(512).astype(np.float32)
    base_emb /= np.linalg.norm(base_emb)

    turn_emb = base_emb + 0.3 * rng.randn(512).astype(np.float32)
    turn_emb /= np.linalg.norm(turn_emb)

    id1 = recognizer._reidentify_unknown(base_emb, person_track_id=1)
    id2 = recognizer._reidentify_unknown(turn_emb, person_track_id=1)
    assert id1 == id2, "Track binding must preserve unknown person ID for the same active track"

if __name__ == "__main__":
    test_virtual_fence_camera_scoping()
    test_anpr_positional_correction()
    test_face_recognizer_track_binding()
    print("All unit tests in test_fixes.py passed successfully!")
