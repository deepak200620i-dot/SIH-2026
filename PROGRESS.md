# IBVAP — Progress Log
### What's done, what's next, and current status

---

## Current Status: 🟢 Step 1 Complete — Ready for Step 2

| Step | Status | Description |
|---|---|---|
| Step 1 | ✅ **Complete** | YOLO26n detection module |
| Step 2 | ⬜ Not started | Tracking + virtual fence |
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
tests/test_detector.py::TestDetectorInit::test_model_loads           PASSED
tests/test_detector.py::TestDetectorInit::test_target_ids_populated  PASSED
tests/test_detector.py::TestDetectorInit::test_config_stored         PASSED
tests/test_detector.py::TestDetection::test_bbox_xywh                PASSED
tests/test_detector.py::TestDetection::test_center                   PASSED
tests/test_detector.py::TestDetectorInference::test_detect_on_blank  PASSED
tests/test_detector.py::TestDetectorInference::test_detect_returns   PASSED
tests/test_detector.py::TestDetectorInference::test_class_filtering  PASSED
tests/test_detector.py::TestDrawDetections::test_draw_returns_copy   PASSED
tests/test_detector.py::TestDrawDetections::test_draw_with_empty     PASSED

10 passed in 12.73s ✅
```

### How to run
```bash
# Install dependencies
pip install -r requirements.txt

# Run unit tests
python -m pytest tests/test_detector.py -v

# Run visual demo (place a video at data/videos/test.mp4 first)
python scripts/run_detection_demo.py

# Or specify a video path
python scripts/run_detection_demo.py --video path/to/video.mp4

# Save annotated output instead of displaying
python scripts/run_detection_demo.py --video path/to/video.mp4 --save
```

### Design decisions made
1. **YOLO26n chosen** — latest Ultralytics model (Jan 2026), NMS-free, ~6MB weights
2. **Auto-download** — model weights download on first run, no manual setup needed
3. **Class filtering built-in** — only person/car/truck/bus/motorcycle/bicycle, configurable via YAML
4. **Frame-in / detections-out** — `Detector` is stateless; the caller owns the video loop
5. **opencv-python-headless** — avoids GUI dependency issues on servers
6. **Module-scoped test fixtures** — YOLO model loaded once across all tests for speed

---

## ⬜ Step 2: Tracking + Virtual Fence — NEXT UP

### What will be built
- `src/tracking/tracker.py` — ByteTrack wrapper using Ultralytics `model.track()`
- `src/rules/virtual_fence.py` — polygon zone intrusion detection
- `tests/test_tracker.py` — tracker unit tests
- `tests/test_virtual_fence.py` — fence logic unit tests
- Updated demo script showing tracked IDs and fence zones

### What it will do
1. **ByteTrack integration** — give each detected object a persistent `track_id` that follows it across frames, even through brief occlusions
2. **Virtual fence zones** — user defines restricted-area polygons in `settings.yaml`
3. **Intrusion detection** — when a tracked object's centre enters a zone polygon → trigger alert
4. **Debouncing** — don't re-alert for the same track_id + zone within a cooldown period

### Depends on
- ✅ Step 1 (Detector) — provides per-frame detections to feed into the tracker

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

*This file is updated after each step is completed. Last updated: 2026-08-31.*
