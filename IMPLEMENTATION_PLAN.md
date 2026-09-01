# IBVAP — Implementation Plan
### Intelligent Border Video Analytics Platform | SIH 2026

---

## 1. Project Overview

**Problem:**  
Conventional border CCTV cameras generate raw video that requires 24/7 human monitoring. Critical intrusion events, unknown faces, and suspicious vehicles are easily missed.

**Solution:**  
IBVAP is a **software-defined analytics layer** that sits on top of any existing CCTV infrastructure. It converts raw video (MP4 or RTSP) into real-time, actionable security events — without requiring dedicated smart-camera hardware.

**One-line pitch:**  
*"Drop in a video feed, get border security intelligence out."*

---

## 2. System Architecture

```
┌─────────────┐
│  CCTV / MP4 │
│  RTSP Feed   │
└──────┬──────┘
       │  frames (OpenCV)
       ▼
┌──────────────────────────────────────────────────────────┐
│                    VIDEO PIPELINE                         │
│                                                          │
│  ┌───────────┐   ┌───────────┐   ┌────────────────────┐ │
│  │  YOLO26n  │──▶│ ByteTrack │──▶│   Rule Engine      │ │
│  │ Detection │   │ Tracker   │   │ • Virtual Fence     │ │
│  └───────────┘   └───────────┘   │ • Loitering         │ │
│        │                         │ • Severity Scoring   │ │
│        │                         └─────────┬──────────┘ │
│        ▼                                   │            │
│  ┌───────────┐   ┌───────────┐             │            │
│  │   Face    │   │   ANPR    │             │            │
│  │ Pipeline  │   │ Pipeline  │             │            │
│  │(InsightFace)  │(EasyOCR)  │             │            │
│  └─────┬─────┘   └─────┬─────┘             │            │
│        │               │                   │            │
│        └───────────────┴───────────────────┘            │
│                        │                                 │
│                   Event + Evidence                       │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  FastAPI Backend    │
              │  • REST endpoints   │
              │  • WebSocket live   │
              │  • SQLite database  │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  React Dashboard    │
              │  • Live event feed  │
              │  • Camera grid      │
              │  • Alert details    │
              │  • Fence editor     │
              │  • Face gallery     │
              └─────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Object Detection** | YOLO26n (Ultralytics) | Latest nano model, NMS-free, fast on CPU/GPU |
| **Object Tracking** | ByteTrack (built into Ultralytics) | Lightweight, persistent IDs, handles occlusion |
| **Face Recognition** | InsightFace (ArcFace) | Pretrained, high accuracy, GPU-accelerated |
| **ANPR / OCR** | EasyOCR or PaddleOCR | Pretrained, multilingual, no training needed |
| **Video I/O** | OpenCV (cv2) | Industry standard, RTSP + MP4 support |
| **Backend API** | FastAPI + Uvicorn | Async, auto-docs, WebSocket support |
| **Database** | SQLite (aiosqlite) | Zero-config, file-based, perfect for prototype |
| **Frontend** | React + Vite + Tailwind CSS | Fast dev, modern UI, component-based |
| **Config** | YAML + python-dotenv | Human-readable, no hard-coded values |

---

## 4. Project Structure

```
SIH/
├── config/
│   ├── settings.yaml              # All thresholds, paths, zone definitions
│   └── .env                       # Secrets (not committed)
├── models/                        # Pretrained weights (git-ignored)
│   └── yolo26n.pt
├── data/
│   ├── videos/                    # Test MP4 files
│   ├── faces/                     # Known-face gallery (name/ subfolders)
│   │   ├── john_doe/
│   │   │   ├── 01.jpg
│   │   │   └── 02.jpg
│   │   └── jane_smith/
│   │       └── 01.jpg
│   └── evidence/                  # Auto-saved alert snapshots
├── src/
│   ├── detection/
│   │   ├── __init__.py
│   │   └── detector.py            # YOLO26n wrapper
│   ├── tracking/
│   │   ├── __init__.py
│   │   └── tracker.py             # ByteTrack via Ultralytics
│   ├── face/
│   │   ├── __init__.py
│   │   └── recognizer.py          # InsightFace face pipeline
│   ├── anpr/
│   │   ├── __init__.py
│   │   └── plate_reader.py        # License plate OCR
│   ├── rules/
│   │   ├── __init__.py
│   │   ├── virtual_fence.py       # Polygon zone intrusion
│   │   ├── loitering.py           # Temporal dwell-time rules
│   │   └── event_engine.py        # Severity scoring, dedup, cooldown
│   ├── pipeline/
│   │   ├── __init__.py
│   │   └── video_pipeline.py      # Main orchestrator
│   ├── api/
│   │   ├── __init__.py
│   │   ├── main.py                # FastAPI app
│   │   ├── routes/
│   │   │   ├── events.py
│   │   │   ├── cameras.py
│   │   │   └── config.py
│   │   └── models.py              # Pydantic schemas
│   └── db/
│       ├── __init__.py
│       ├── database.py            # SQLite connection
│       └── crud.py                # Create/read helpers
├── frontend/                      # React dashboard
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── EventFeed.jsx
│       │   ├── CameraGrid.jsx
│       │   ├── AlertDetail.jsx
│       │   ├── FenceEditor.jsx
│       │   └── FaceGallery.jsx
│       └── services/
│           └── api.js
├── tests/
│   ├── test_detector.py
│   ├── test_tracker.py
│   ├── test_virtual_fence.py
│   └── test_event_engine.py
├── scripts/
│   ├── run_detection_demo.py
│   └── download_models.py
├── requirements.txt
├── IMPLEMENTATION_PLAN.md         # ← This file
├── PROGRESS.md                    # ← Progress tracker
├── README.md
└── run.py                         # CLI entry-point
```

---

## 5. Seven-Step Build Plan

Each step is built, tested, and verified independently before moving to the next.

---

### STEP 1: YOLO26n Detection ✅

**Goal:** Detect persons and vehicles in video frames using a pretrained model.

**What we build:**
- `src/detection/detector.py` — `Detector` class wrapping Ultralytics YOLO26n
- `Detection` dataclass — structured output: bounding box, confidence, class name
- `FrameResult` dataclass — per-frame container with timing metadata
- `scripts/run_detection_demo.py` — visual demo with HUD overlay
- `tests/test_detector.py` — 10 unit tests

**How it works:**
1. Load YOLO26n pretrained weights (auto-download on first run, ~6MB)
2. For each frame: `model.predict(frame, conf=0.35)` → raw Ultralytics results
3. Filter to target COCO classes: person, car, truck, bus, motorcycle, bicycle
4. Convert to `Detection` dataclass with `bbox_xyxy`, confidence, class info
5. Draw annotated bounding boxes with colour-coded class labels
6. Report inference time and FPS

**Config:**
```yaml
detection:
  model_path: "models/yolo26n.pt"
  confidence: 0.35
  target_classes: [person, car, truck, bus, motorcycle, bicycle]
```

---

### STEP 2: Tracking + Virtual Fence

**Goal:** Give each detected object a persistent ID across frames. Trigger alerts when objects enter restricted zones.

**What we build:**
- `src/tracking/tracker.py` — `Tracker` class using Ultralytics built-in ByteTrack
- `src/rules/virtual_fence.py` — `VirtualFence` class with polygon zone intrusion logic
- `tests/test_tracker.py` + `tests/test_virtual_fence.py`
- Updated demo script showing tracked IDs and fence zones

**How it works:**
1. Replace `model.predict()` with `model.track(frame, tracker="bytetrack.yaml", persist=True)`
2. Ultralytics returns the same boxes but with track IDs assigned
3. Wrap results in `TrackedObject` dataclass: detection fields + `track_id` + `track_age`
4. Virtual fence zones defined as polygons in `settings.yaml`:
   ```yaml
   fence:
     zones:
       - name: "restricted_area_1"
         polygon: [[100,200], [400,200], [400,500], [100,500]]
         severity: "high"
   ```
5. For each tracked object, test if its centre point falls inside any polygon (Shapely or cv2 `pointPolygonTest`)
6. On intrusion → emit a `FenceEvent` with object ID, zone name, timestamp, severity
7. **Debouncing:** Don't re-alert for the same track_id + zone within a cooldown window

**Key algorithm — Point-in-Polygon:**
```python
import cv2
import numpy as np

def is_inside(point, polygon):
    contour = np.array(polygon, dtype=np.int32)
    return cv2.pointPolygonTest(contour, point, False) >= 0
```

---

### STEP 3: Face Detection + Recognition

**Goal:** Detect faces in person crops. Match against a known gallery. Label as known name or "unknown".

**What we build:**
- `src/face/recognizer.py` — `FaceRecognizer` class using InsightFace
- Known-face gallery in `data/faces/<name>/` folders
- Integration into the pipeline: person detected → crop → face detect → recognize
- `tests/test_face_recognizer.py`

**How it works:**
1. **Gallery loading:** On startup, scan `data/faces/`. For each person folder, load images, extract 512-d ArcFace embeddings, store as numpy array keyed by name.
2. **Per-frame pipeline:**
   - For each detected `person` box, crop the region from the frame
   - Run InsightFace `app.get(crop)` → returns face bounding boxes + embeddings
   - Compare each face embedding against gallery using cosine similarity
   - If best match > `similarity_threshold` (default 0.6) → known person
   - Otherwise → "unknown"
3. **Output:** `FaceMatch` dataclass: `face_bbox`, `person_track_id`, `name`, `confidence`, `is_known`
4. **Separate pipeline:** Face recognition runs independently from YOLO detection — YOLO finds persons, face pipeline processes person crops

**Why InsightFace:**
- Pretrained ArcFace model — no training needed
- State-of-the-art accuracy on face benchmarks
- Built-in face detection + alignment + embedding extraction
- GPU-accelerated

---

### STEP 4: FastAPI + SQLite + Event Engine

**Goal:** Persist events to a database. Expose REST + WebSocket API. Add severity scoring and deduplication.

**What we build:**
- `src/rules/event_engine.py` — `EventEngine` class for severity, dedup, cooldown
- `src/db/database.py` — SQLite schema + connection
- `src/db/crud.py` — create/read event helpers
- `src/api/main.py` — FastAPI application
- `src/api/routes/events.py` — GET /events, GET /events/{id}
- `src/api/routes/cameras.py` — GET /cameras
- `src/api/routes/config.py` — POST /config/fence
- `src/api/models.py` — Pydantic request/response schemas

**Database schema (SQLite):**
```sql
CREATE TABLE events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT    NOT NULL,           -- ISO 8601
    event_type  TEXT    NOT NULL,           -- 'intrusion', 'face_match', 'face_unknown', 'anpr', 'loitering'
    severity    TEXT    NOT NULL,           -- 'low', 'medium', 'high', 'critical'
    camera_id   TEXT    DEFAULT 'cam_01',
    track_id    INTEGER,
    class_name  TEXT,
    zone_name   TEXT,
    face_name   TEXT,
    plate_text  TEXT,
    confidence  REAL,
    bbox        TEXT,                       -- JSON: [x1, y1, x2, y2]
    snapshot    TEXT,                       -- path to evidence image
    metadata    TEXT,                       -- JSON: extra data
    created_at  TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE cameras (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    source      TEXT    NOT NULL,           -- RTSP URL or file path
    status      TEXT    DEFAULT 'active',
    created_at  TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE known_faces (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    image_path  TEXT,
    embedding   BLOB,                      -- numpy array as bytes
    created_at  TEXT    DEFAULT (datetime('now'))
);
```

**Event engine rules:**
| Rule | Logic |
|---|---|
| **Severity scoring** | Intrusion in "high" zone → `critical`. Unknown face → `high`. Known face → `low` (info). ANPR → `medium`. |
| **Deduplication** | Same `track_id` + `event_type` + `zone_name` within `cooldown_seconds` → skip |
| **Cooldown** | Default 30 seconds between duplicate alerts for the same object/zone |
| **Evidence capture** | Save annotated frame snapshot to `data/evidence/{timestamp}_{event_type}.jpg` |

**API endpoints:**
| Method | Path | Description |
|---|---|---|
| GET | `/api/events` | List events (paginated, filterable by type/severity/date) |
| GET | `/api/events/{id}` | Single event with full metadata |
| GET | `/api/events/stream` | WebSocket — push events in real-time |
| GET | `/api/cameras` | List configured cameras |
| POST | `/api/config/fence` | Update virtual fence zones |
| GET | `/api/stats` | Summary counts (total events, by type, by severity) |
| GET | `/api/evidence/{filename}` | Serve evidence snapshot images |

---

### STEP 5: React Dashboard

**Goal:** A web UI where a judge can see live events, camera feeds, alert details, and manage the system.

**What we build:**
- Vite + React + Tailwind CSS application in `frontend/`
- Components: EventFeed, CameraGrid, AlertDetail, FenceEditor, FaceGallery
- WebSocket connection for real-time updates

**Pages / Views:**
| Page | Components | Description |
|---|---|---|
| **Dashboard** | EventFeed, StatsBar | Live scrolling event list with severity badges, click to expand |
| **Camera View** | CameraGrid | Video feed thumbnails with overlaid detection boxes |
| **Alert Detail** | AlertDetail modal | Full event info: snapshot image, bounding boxes, timestamp, severity, face match result |
| **Fence Config** | FenceEditor | Draw polygon zones on a video frame, set zone names and severity |
| **Face Gallery** | FaceGallery | View/add/remove known faces in the gallery |

**UI Design principles:**
- Dark theme (security/ops aesthetic)
- Real-time: WebSocket pushes events instantly
- Severity colour coding: 🔴 Critical, 🟠 High, 🟡 Medium, 🟢 Low
- Evidence snapshots embedded in alert cards
- Responsive layout (works on laptop + wall-mounted monitor)

---

### STEP 6: ANPR + Loitering + Integration

**Goal:** Add vehicle plate reading and dwell-time alerts. Wire everything into the unified pipeline.

**What we build:**
- `src/anpr/plate_reader.py` — crop vehicle region → OCR → plate text
- `src/rules/loitering.py` — track dwell-time per object in a zone
- `src/pipeline/video_pipeline.py` — unified orchestrator

**ANPR pipeline:**
1. For each detected `car`/`truck`/`bus`, crop the bounding box region
2. Optionally run a secondary YOLO model trained on license plates (or use the vehicle crop directly)
3. Run EasyOCR / PaddleOCR on the plate region → text string
4. Clean and validate plate format (regex for Indian plates: `[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}`)
5. Emit `anpr` event with plate text

**Loitering detection:**
1. Track how long each `track_id` has been inside each zone (using tracking timestamps)
2. If dwell-time exceeds `loitering_threshold_seconds` (configurable, default 60s) → emit `loitering` event
3. Only alert once per track_id per zone (with cooldown)

**Unified pipeline (`video_pipeline.py`):**
```
frame → YOLO detect → ByteTrack → for each tracked object:
  ├── Virtual fence check → intrusion event?
  ├── Loitering check → loitering event?
  ├── If person → face pipeline → face match event?
  └── If vehicle → ANPR pipeline → plate event?
      │
      ▼
  Event Engine → dedup/severity → SQLite → WebSocket push
```

---

### STEP 7: Testing, Performance, Polish

**Goal:** End-to-end verification, performance benchmarks, error handling, and demo readiness.

**What we do:**
- [ ] End-to-end integration test with a full test video
- [ ] Measure and report: detection FPS, tracking FPS, face recognition latency, ANPR accuracy
- [ ] Stress test: what happens with 50+ simultaneous detections?
- [ ] Error handling: missing frames, camera disconnect, model load failure
- [ ] Graceful RTSP reconnection
- [ ] Demo script for judges: `python run.py --demo`
- [ ] README with setup instructions, screenshots, architecture diagram
- [ ] Final UI polish: loading states, error messages, empty states

**Performance targets (measured, not invented):**
| Metric | Target (CPU) | Target (GPU) |
|---|---|---|
| Detection FPS | ≥ 10 | ≥ 30 |
| Tracking overhead | < 5ms/frame | < 2ms/frame |
| Face recognition | < 200ms/face | < 50ms/face |
| Event-to-dashboard latency | < 500ms | < 200ms |

---

## 6. Demo Scenario for Judges

The end-to-end demo should show:

1. **Video plays** — a border surveillance clip (or live RTSP feed)
2. **Persons and vehicles detected** — bounding boxes with class labels and confidence
3. **Tracking** — each object gets a persistent ID that follows it across frames
4. **Intrusion alert** — a person walks into a red restricted zone → 🔴 CRITICAL alert fires
5. **Face recognised** — a known person is identified by name; an unknown face triggers a 🟠 HIGH alert
6. **Vehicle plate read** (if ANPR is ready) — a car's plate is OCR'd and displayed
7. **Dashboard** — all events appear in real-time on the React UI with snapshots and severity

---

## 7. Engineering Principles

| Principle | How we enforce it |
|---|---|
| **Modular** | Each pipeline stage is a separate class in its own file |
| **Configurable** | `settings.yaml` for all thresholds, paths, zones — zero hard-coding |
| **Pretrained only** | YOLO26n, InsightFace ArcFace, EasyOCR — no custom training |
| **Testable** | Unit tests for every rule/engine module; pytest |
| **Measurable** | FPS, latency, and accuracy are measured and printed — never invented |
| **Explainable** | Intrusion = point-in-polygon. Loitering = dwell-time > threshold. No black-box rules. |
| **Anti-spam** | Cooldown timers and deduplication prevent alert floods |
| **Evidence-first** | Every alert saves a snapshot with bounding boxes and metadata |
| **Graceful failure** | Missing frames → skip. Camera down → reconnect. Model fail → log and continue. |

---

## 8. Dependencies

### Python (Backend)
```
ultralytics>=8.3        # YOLO26n
opencv-python-headless   # Video I/O
numpy                    # Array ops
insightface              # Face recognition (Step 3)
onnxruntime              # InsightFace backend
easyocr                  # ANPR OCR (Step 6)
fastapi                  # REST API (Step 4)
uvicorn                  # ASGI server
aiosqlite                # Async SQLite
pydantic                 # Data validation
pyyaml                   # Config parsing
python-dotenv            # Env vars
websockets               # Real-time push
pytest                   # Testing
```

### Node.js (Frontend)
```
react + react-dom
vite
tailwindcss
axios                    # HTTP client
recharts                 # Charts
react-icons              # Icons
```

---

*This document is the single source of truth for what IBVAP is and how every piece fits together. Updated as we progress through each step.*
