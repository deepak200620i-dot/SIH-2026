# IBVAP — Progress Log
### What's done, what's next, and current status

---

## Current Status: 🟢 Step 2 Complete — Ready for Step 3

| Step | Status | Description |
|---|---|---|
| Step 1 | ✅ **Complete** | YOLO26n detection module |
| Step 2 | ✅ **Complete** | Tracking + virtual fence |
| Step 3 | ⬜ Not started | Face detection + recognition |
| Step 4 | ⬜ Not started | FastAPI + SQLite + event engine |
| Step 5 | ⬜ Not started | React dashboard |
| Step 6 | ⬜ Not started | ANPR + loitering + integration |
| Step 7 | ⬜ Not started | Testing, performance, polish |

---

## ✅ Step 1: YOLO26n Detection — COMPLETE

**Date completed:** 2026-08-31

### What was built

| File | Purpose |
|---|---|
| `requirements.txt` | Python dependencies (ultralytics, opencv, numpy, pyyaml, pytest) |
| `config/settings.yaml` | Central config — model path, confidence, target classes, video source |
| `config/.env` | Secrets placeholder (empty for now) |
| `.gitignore` | Ignores models, videos, evidence, __pycache__, .env, node_modules |
| `src/detection/__init__.py` | Package init |
| `src/detection/detector.py` | **Core module** — YOLO26n detection wrapper |
| `scripts/run_detection_demo.py` | Visual demo script with HUD overlay |
| `tests/test_detector.py` | 10 unit tests |

### Key components in `detector.py`

- **`Detection` dataclass** — Structured result per detected object:
  - `bbox_xyxy` (x1, y1, x2, y2)
  - `confidence` (0-1)
  - `class_id` (COCO index)
  - `class_name` (e.g. "person", "car")
  - Computed properties: `bbox_xywh`, `center`

- **`FrameResult` dataclass** — Per-frame container:
  - `detections` list
  - `inference_ms` (YOLO internal)
  - `total_ms` (wall-clock)
  - `frame_index`

- **`Detector` class** — Main interface:
  - `__init__(config)` — loads YOLO26n, sets up class filtering
  - `detect(frame, frame_index)` → `FrameResult`
  - `warmup()` — dummy inference to pre-allocate memory
  - `draw_detections(frame, detections)` — static method, draws colour-coded boxes

### Test results
```
tests/test_detector.py — 10 passed ✅
```

### Design decisions made
1. **YOLO26n chosen** — latest Ultralytics model (Jan 2026), NMS-free, ~6MB weights
2. **Auto-download** — model weights download on first run, no manual setup needed
3. **Class filtering built-in** — only person/car/truck/bus/motorcycle/bicycle, configurable via YAML
4. **Frame-in / detections-out** — `Detector` is stateless; the caller owns the video loop
5. **opencv-python-headless** — avoids GUI dependency issues on servers
6. **Module-scoped test fixtures** — YOLO model loaded once across all tests for speed

---

## ✅ Step 2: Tracking + Virtual Fence — COMPLETE

**Date completed:** 2026-09-01

### What was built

| File | Purpose |
|---|---|
| `src/tracking/tracker.py` | **Core module** — ByteTrack tracker via Ultralytics `model.track()` |
| `src/rules/virtual_fence.py` | **Core module** — Polygon zone intrusion detection with debouncing |
| `tests/test_tracker.py` | 16 unit tests for the Tracker |
| `tests/test_virtual_fence.py` | 21 unit tests for the VirtualFence |
| `scripts/run_tracking_demo.py` | Visual demo with tracked IDs + fence zone overlays |
| `config/settings.yaml` | Updated with `tracking` section + active fence zone definitions |

### Key components in `tracker.py`

- **`TrackedObject` dataclass** — Extends Detection with tracking:
  - `bbox_xyxy`, `confidence`, `class_id`, `class_name` (same as Detection)
  - `track_id` — persistent ByteTrack ID (-1 if unassigned)
  - Computed properties: `bbox_xywh`, `center`

- **`TrackingResult` dataclass** — Per-frame container:
  - `tracked_objects` list
  - `inference_ms`, `total_ms`, `frame_index`
  - `active_track_count` — unique active tracks this frame

- **`Tracker` class** — Main interface:
  - `__init__(config)` — loads YOLO26n, configures ByteTrack
  - `track(frame, frame_index)` → `TrackingResult` (uses `model.track(persist=True)`)
  - `get_track_age(track_id)` — frames since track was first seen
  - `reset()` — clears tracking state for new video
  - `warmup()` — dummy inference
  - `draw_tracks(frame, tracked_objects)` — static method, draws boxes with ID labels + centre dots

### Key components in `virtual_fence.py`

- **`FenceZone` dataclass** — Zone definition:
  - `name`, `polygon` (vertex list), `severity` (low/medium/high/critical)
  - `np_polygon` property for OpenCV compatibility

- **`FenceEvent` dataclass** — Alert payload:
  - `track_id`, `zone_name`, `severity`, `timestamp`
  - `class_name`, `confidence`, `bbox_xyxy`, `center`

- **`VirtualFence` class** — Main interface:
  - `__init__(zones, cooldown_seconds)` — parses zone config
  - `is_inside(point, polygon)` — static, uses `cv2.pointPolygonTest`
  - `check(tracked_objects, timestamp)` → `list[FenceEvent]` (with debouncing)
  - `reset()` — clears cooldown state
  - `draw_zones(frame, zones, alpha)` — static, draws semi-transparent zone overlays

### Test results
```
tests/test_tracker.py         — 16 passed ✅
tests/test_virtual_fence.py   — 21 passed ✅
Full suite (all 3 files)      — 47 passed in 2.99s ✅
```

### How to run
```bash
# Run tracker unit tests
python -m pytest tests/test_tracker.py -v

# Run virtual fence unit tests
python -m pytest tests/test_virtual_fence.py -v

# Run ALL tests (Step 1 + Step 2)
python -m pytest tests/ -v

# Run tracking + fence demo (place a video at data/videos/test.mp4 first)
python scripts/run_tracking_demo.py

# Or specify a video path
python scripts/run_tracking_demo.py --video path/to/video.mp4

# Save annotated output instead of displaying
python scripts/run_tracking_demo.py --video path/to/video.mp4 --save
```

### Design decisions made
1. **Tracker owns its own YOLO model** — `model.track(persist=True)` maintains internal state, so sharing with Detector would cause conflicts
2. **Same config structure** — Tracker accepts the same `detection` config keys as Detector, plus optional `tracker` key
3. **Track age tracked internally** — `_track_history` dict records when each track_id was first seen
4. **cv2.pointPolygonTest** — chosen over Shapely for zero extra dependencies; `>= 0` includes edge points
5. **Cooldown-based debouncing** — `(track_id, zone_name)` key prevents alert floods; cooldown is configurable
6. **Mock objects in fence tests** — `_MockTrackedObject` avoids importing YOLO, making fence tests fast (~1s)
7. **Two demo scripts** — `run_detection_demo.py` (Step 1) and `run_tracking_demo.py` (Step 2) kept separate
8. **Two example fence zones** in `settings.yaml` — a `restricted_area_1` (high) and `perimeter_zone` (critical)

---

## Future Steps (not started)

### Step 3: Face Detection + Recognition
- InsightFace ArcFace pipeline
- Known-face gallery in `data/faces/<name>/`
- Runs on person crops from YOLO detections

### Step 4: FastAPI + SQLite + Event Engine
- REST API, WebSocket, SQLite database
- Event severity scoring, dedup, cooldown
- Evidence snapshot storage

### Step 5: React Dashboard
- Vite + React + Tailwind CSS
- Live event feed, camera grid, alert detail, fence editor

### Step 6: ANPR + Loitering + Integration
- Vehicle plate OCR via EasyOCR
- Dwell-time loitering detection
- Unified video pipeline orchestrator

### Step 7: Testing, Performance, Polish
- End-to-end integration test
- FPS / latency benchmarks
- Demo script for judges
- README + documentation

---

*This file is updated after each step is completed. Last updated: 2026-09-01.*
