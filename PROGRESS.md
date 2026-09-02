# IBVAP — Progress Log
### What's done, what's next, and current status

---

## Current Status: 🟢 Step 4 Complete — Ready for Step 6

| Step | Status | Description |
|---|---|---|
| Step 1 | ✅ **Complete** | YOLO26n detection module |
| Step 2 | ✅ **Complete** | Tracking + virtual fence |
| Step 3 | ✅ **Complete** | Face detection + recognition |
| Step 4 | ✅ **Complete** | FastAPI + SQLite + event engine |
| Step 5 | 🚧 In progress | React dashboard (being worked on by Ridham) |
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

## ✅ Step 3: Face Detection + Recognition — COMPLETE

**Date completed:** 2026-09-01

### What was built

| File | Purpose |
|---|---|
| `src/face/recognizer.py` | **Core module** — InsightFace (ArcFace) face detection + recognition |
| `src/face/__init__.py` | Package exports (`FaceRecognizer`, `FaceMatch`, `GalleryEntry`) |
| `tests/test_face_recognizer.py` | 38 unit tests (fully mocked, no model download needed) |
| `scripts/run_face_demo.py` | Visual demo: tracking + fence + face recognition combined |
| `config/settings.yaml` | Updated `face:` section with full InsightFace config |
| `requirements.txt` | Added `insightface>=0.7.3` + `onnxruntime>=1.17` |

### Key components in `recognizer.py`

- **`FaceMatch` dataclass** — Recognition result per detected face:
  - `face_bbox` (x1, y1, x2, y2) — face box in original frame coordinates
  - `person_bbox` — YOLO person bounding box
  - `person_track_id` — ByteTrack ID (-1 if untracked)
  - `name` — matched person name or "unknown"
  - `confidence` — cosine similarity score (0-1)
  - `is_known` — True if matched above threshold
  - `det_score` — face detection confidence
  - `embedding` — 512-d ArcFace embedding (optional, for storage)
  - Computed property: `face_center`

- **`GalleryEntry` dataclass** — Known person in gallery:
  - `name`, `embeddings` (list of 512-d vectors), `image_count`
  - Computed property: `mean_embedding` (L2-normalised mean)

- **`FaceRecognizer` class** — Main interface:
  - `__init__(config)` — loads InsightFace model + scans gallery folder
  - `recognize(frame, person_bbox, track_id)` → `FaceMatch | None`
  - `recognize_frame(frame, tracked_objects)` → `list[FaceMatch]`
  - `add_face_embedding(name, embedding)` — add to gallery programmatically
  - `gallery_size`, `gallery_names` — gallery introspection properties
  - `draw_face_matches(frame, matches)` — static method, green for known / red for unknown

### Pipeline flow
```
For each frame:
  YOLO detect → ByteTrack track → for each person:
    → crop person region from frame
    → InsightFace detect face in crop
    → extract 512-d ArcFace embedding
    → cosine similarity match against gallery
    → FaceMatch result (known name or "unknown")
```

### Gallery structure
```
data/faces/
├── john_doe/
│   ├── 01.jpg
│   └── 02.jpg
├── jane_smith/
│   └── 01.jpg
└── .gitkeep
```
Each subfolder = one person. On startup, all images are processed to extract face embeddings.

### Test results
```
tests/test_face_recognizer.py — 38 passed ✅
Full suite (all 4 files)      — 85 passed in 3.50s ✅
```

### How to run
```bash
# Run face recognition unit tests
python -m pytest tests/test_face_recognizer.py -v

# Run ALL tests (Step 1 + 2 + 3)
python -m pytest tests/ -v

# Run face recognition demo
python scripts/run_face_demo.py --video path/to/video.mp4

# With custom gallery and threshold
python scripts/run_face_demo.py --video path/to/video.mp4 --gallery data/faces --threshold 0.5

# Save annotated output
python scripts/run_face_demo.py --video path/to/video.mp4 --save
```

### Design decisions made
1. **InsightFace `buffalo_l` model pack** — includes RetinaFace detector + ArcFace recognizer, pretrained, no training needed
2. **Lazy import** — `from insightface.app import FaceAnalysis` inside `_load_model()` to avoid import errors when just running tests
3. **Gallery loads on startup** — scans `data/faces/` subfolders, extracts embeddings, stores in memory
4. **Largest face in gallery images** — when a reference image has multiple faces, takes the largest one
5. **Most confident face in crops** — when a person crop has multiple faces, takes the highest `det_score`
6. **Cosine similarity via dot product** — embeddings are L2-normalised, so `np.dot(a, b)` = cosine similarity
7. **Fully mocked tests** — all 38 tests use mock InsightFace objects, run in 0.30s without model downloads
8. **Frame coordinate conversion** — face bbox detected in crop coordinates is converted to original frame coordinates
9. **CPU by default** — `gpu_id: -1` in config; set to `0+` for CUDA acceleration
10. **Person-only processing** — `recognize_frame()` skips non-person tracked objects (cars, trucks, etc.)

---

## ✅ Step 4: FastAPI + SQLite + Event Engine — COMPLETE

**Date completed:** 2026-09-02

### What was built

| File | Purpose |
|---|---|
| `src/rules/event_engine.py` | **Core module** — Event severity scoring, cooldown dedup, evidence snapshot capturing |
| `src/db/database.py` | SQLite async connection manager + schema creation (`events`, `cameras`, `known_faces`) |
| `src/db/crud.py` | Async CRUD queries (create event, paginated filter events, summary stats, camera CRUD) |
| `src/api/models.py` | Pydantic request & response schemas for REST API & WebSocket payloads |
| `src/api/routes/events.py` | GET /api/events, GET /api/events/stats, GET /api/events/{id}, POST /api/events, WS /api/events/stream |
| `src/api/routes/cameras.py` | GET /api/cameras, POST /api/cameras |
| `src/api/routes/config.py` | GET /api/config/fence, POST /api/config/fence |
| `src/api/main.py` | FastAPI application entrypoint, CORS middleware, static file mounting (`/api/evidence`) |
| `tests/test_event_engine.py` | 5 unit tests for EventEngine |
| `tests/test_db.py` | 4 async unit tests for database and CRUD functions |
| `tests/test_api.py` | 5 integration tests for REST endpoints and WebSocket stream |

### Test results
```
tests/test_event_engine.py — 5 passed ✅
tests/test_db.py           — 4 passed ✅
tests/test_api.py          — 5 passed ✅
```

---

## Future Steps

### Step 5: React Dashboard (In Progress by Ridham)
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

Frontend ie step 5 is under working by Ridham
