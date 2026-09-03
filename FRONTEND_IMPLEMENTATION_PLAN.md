# IBVAP Frontend — Complete Implementation Plan

Build a production-ready React frontend for the Intelligent Border Video Analytics Platform. The frontend consumes backend APIs that are **not yet implemented** (Steps 3-7 pending), so every component must handle unavailable/offline states gracefully with zero mock data.

## User Review Required

> [!IMPORTANT]
> The backend API (Step 4) is **not yet built** — the `src/api/` directory only contains empty `__init__.py` files. The frontend will attempt to connect to all documented endpoints but will display professional offline/empty states when the backend is unavailable. No fake data will be injected.

> [!IMPORTANT]
> The API base URL will default to `http://localhost:8000` (FastAPI default) and the WebSocket to `ws://localhost:8000/api/events/stream`. Both are configurable via Vite environment variables.

## Proposed Changes

### File Structure

```
frontend/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── .env                          # Default API URL config
└── src/
    ├── main.jsx                  # React entry point
    ├── App.jsx                   # Router + Layout
    ├── index.css                 # Tailwind directives + custom styles
    │
    ├── services/
    │   ├── api.js                # Axios instance + all API functions
    │   └── websocket.js          # WebSocket manager with reconnect
    │
    ├── hooks/
    │   ├── useWebSocket.js       # WebSocket hook with state
    │   ├── useEvents.js          # Events data hook
    │   ├── useCameras.js         # Cameras data hook
    │   └── useStats.js           # Stats data hook
    │
    ├── context/
    │   └── SystemContext.jsx     # Global system status (API, WS, threat)
    │
    ├── utils/
    │   ├── constants.js          # Severity colors, event types, etc.
    │   └── formatters.js         # Time, confidence, bbox formatters
    │
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.jsx       # Persistent nav sidebar
    │   │   └── Layout.jsx        # Page shell: sidebar + topbar + content
    │   │
    │   ├── common/
    │   │   ├── SeverityBadge.jsx  # Reusable severity pill
    │   │   ├── StatusIndicator.jsx # Online/offline dot
    │   │   ├── LoadingState.jsx   # Skeleton/spinner state
    │   │   ├── EmptyState.jsx     # "No data" state
    │   │   └── ErrorState.jsx     # API failure state
    │   │
    │   ├── dashboard/
    │   │   ├── StatsBar.jsx       # Top stats row
    │   │   ├── ThreatLevel.jsx    # Current threat indicator
    │   │   ├── SystemStatus.jsx   # System/API/WS status strip
    │   │   ├── CameraHealth.jsx   # Camera online/offline strip
    │   │   └── EventTimeline.jsx  # Compact chronological timeline
    │   │
    │   ├── EventFeed.jsx          # Scrolling real-time event list
    │   ├── CameraGrid.jsx         # Camera card grid
    │   ├── CameraCard.jsx         # Individual camera card with HUD
    │   ├── AlertDetail.jsx        # Alert detail modal/panel
    │   ├── FenceEditor.jsx        # Polygon zone drawing tool
    │   └── FaceGallery.jsx        # Known faces gallery
    │
    └── pages/
        ├── Dashboard.jsx          # Main command center view
        ├── LiveCameras.jsx        # Full camera grid page
        ├── Alerts.jsx             # Active alerts page
        ├── EventHistory.jsx       # Filterable event history
        ├── FenceConfig.jsx        # Fence editor page
        └── FaceGalleryPage.jsx    # Face gallery page
```

---

### Infrastructure & Config

#### [NEW] [package.json](file:///C:/Users/ridha/OneDrive/Desktop/SIH-2026/frontend/package.json)
Dependencies: `react`, `react-dom`, `react-router-dom`, `axios`, `react-icons`, `recharts`. Dev: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`.

#### [NEW] [vite.config.js](file:///C:/Users/ridha/OneDrive/Desktop/SIH-2026/frontend/vite.config.js)
Vite config with React plugin and API proxy to `localhost:8000`.

#### [NEW] [tailwind.config.js](file:///C:/Users/ridha/OneDrive/Desktop/SIH-2026/frontend/tailwind.config.js)
Dark mode by class, custom colors for severity (critical-red, high-orange, medium-amber, low-green), custom ops-console fonts.

#### [NEW] [index.html](file:///C:/Users/ridha/OneDrive/Desktop/SIH-2026/frontend/index.html)
Entry HTML with dark background, Inter font.

#### [NEW] [.env](file:///C:/Users/ridha/OneDrive/Desktop/SIH-2026/frontend/.env)
`VITE_API_URL=http://localhost:8000` and `VITE_WS_URL=ws://localhost:8000/api/events/stream`.

---

### Services Layer

#### [NEW] [api.js](file:///C:/Users/ridha/OneDrive/Desktop/SIH-2026/frontend/src/services/api.js)
Centralized Axios instance. Functions:
- `getEvents(params)` → `GET /api/events` with filters (severity, event_type, camera_id, limit, offset)
- `getEvent(id)` → `GET /api/events/{id}`
- `getCameras()` → `GET /api/cameras`
- `getStats()` → `GET /api/stats`
- `getEvidenceUrl(filename)` → constructs URL for `GET /api/evidence/{filename}`
- `saveFence(zones)` → `POST /api/config/fence`
- `getKnownFaces()` → `GET /api/faces` (planned endpoint)
- `addKnownFace(formData)` → `POST /api/faces`
- `removeKnownFace(id)` → `DELETE /api/faces/{id}`

All functions catch errors and return `{ data, error }` pattern.

#### [NEW] [websocket.js](file:///C:/Users/ridha/OneDrive/Desktop/SIH-2026/frontend/src/services/websocket.js)
WebSocket manager class:
- Auto-reconnect with exponential backoff (1s → 2s → 4s → 8s → 16s max)
- Connection state: `connecting`, `connected`, `disconnected`, `reconnecting`
- Event callbacks: `onEvent`, `onStatusChange`
- Heartbeat detection

---

### Custom Hooks

#### [NEW] useWebSocket.js
React hook wrapping the WebSocket manager. Provides: `status`, `events[]`, `isConnected`.

#### [NEW] useEvents.js
Fetches events from REST API + merges with WebSocket events. Provides: `events`, `loading`, `error`, `refetch`.

#### [NEW] useCameras.js
Fetches camera list. Provides: `cameras`, `loading`, `error`, `refetch`.

#### [NEW] useStats.js
Fetches stats. Provides: `stats`, `loading`, `error`, `refetch`.

---

### Context

#### [NEW] SystemContext.jsx
Global context providing:
- `apiStatus` — tested via a health check on mount
- `wsStatus` — from WebSocket manager
- `cameras` — camera list + online count
- `threatLevel` — derived from highest active event severity
- `recentEvents` — combined REST + WS events

---

### Common Components

#### [NEW] SeverityBadge.jsx
Color-coded severity pill: `CRITICAL` → red, `HIGH` → orange, `MEDIUM` → amber, `LOW` → green. Supports `size` prop.

#### [NEW] StatusIndicator.jsx
Small colored dot with label: green for online, red for offline, yellow for connecting.

#### [NEW] LoadingState.jsx / EmptyState.jsx / ErrorState.jsx
Professional placeholder states with icons and messages. Dark themed, operations-style.

---

### Dashboard Components

#### [NEW] StatsBar.jsx
Horizontal stat cards: Camera Count, People Detected, Vehicles Detected, Active Alerts, Total Events. Values from `GET /api/stats`. Shows "—" when unavailable.

#### [NEW] ThreatLevel.jsx
Compact indicator showing the highest active severity. Pulses on CRITICAL. Derived from actual events, not a fake AI model.

#### [NEW] SystemStatus.jsx
Status strip: `● SYSTEM ONLINE`, `● API CONNECTED`, `● WS CONNECTED`, camera count. Real status from context.

#### [NEW] CameraHealth.jsx
Compact list of cameras with online/offline dots. From `GET /api/cameras`.

#### [NEW] EventTimeline.jsx
Compact chronological timeline with timestamp, severity badge, zone, camera. From recent events.

---

### Core Components

#### [NEW] EventFeed.jsx
Scrolling event list. Each row: severity badge, event type, zone, camera, timestamp. Click opens AlertDetail. Auto-scrolls on new WebSocket events. Max 100 events in memory.

#### [NEW] CameraGrid.jsx
Responsive grid of CameraCards. 1-4 columns depending on screen width. Props: `cameras[]`, `onCameraClick`.

#### [NEW] CameraCard.jsx
Security monitor–style card:
- Camera name + ID header
- Online/offline status indicator
- Evidence frame/snapshot area (from `GET /api/evidence/{snapshot}`)
- Detection HUD overlay: `OBJECT`, `CONFIDENCE%`, `TRACK #ID`
- Bounding box drawing via CSS overlay (positioned absolutely over the image using bbox percentages)
- Professional offline state when camera is down

#### [NEW] AlertDetail.jsx
Modal/slide-over panel showing full event details:
- Evidence snapshot (full size)
- Severity + event type header
- Timestamp, camera, track ID, zone
- Detected class + confidence
- Face match info (if `face_name` present)
- ANPR plate (if `plate_text` present)
- Bounding box visualization
- **"WHY THIS ALERT?"** section — constructed from actual event fields:
  - Detected: `{class_name}` → Zone: `{zone_name}` → Rule: `{event_type}` → Severity: `{severity}`
- Metadata display

#### [NEW] FenceEditor.jsx
Canvas-based polygon drawing tool:
- Loads a camera frame as background (fetched from backend or file input fallback)
- Click to place polygon vertices
- Visual polygon with semi-transparent fill
- Zone name input field
- Severity selector (low/medium/high/critical)
- Clear/undo vertex controls
- Save button → `POST /api/config/fence`
- Handles backend unavailable state

#### [NEW] FaceGallery.jsx
Grid of known face cards:
- Face image, name, creation date
- Add face button (file upload + name input)
- Remove face button
- Loading/empty/error states
- Handles backend unavailable

---

### Pages

#### [NEW] Dashboard.jsx
Main command center layout:
- **Top row**: SystemStatus + ThreatLevel
- **Stats row**: StatsBar
- **Main area** (2 columns on desktop):
  - Left (wider): Live camera preview (top 4 cameras) + EventFeed
  - Right: CameraHealth + EventTimeline + Active alerts summary
- Uses SystemContext for all data

#### [NEW] LiveCameras.jsx
Full-page CameraGrid with all cameras. Click opens AlertDetail for recent events on that camera.

#### [NEW] Alerts.jsx
Active/recent alerts page. Shows AlertDetail when clicking an event. Filters by severity.

#### [NEW] EventHistory.jsx
Full event history with filters:
- Severity dropdown
- Event type dropdown
- Camera dropdown
- Date range picker (basic date inputs)
- Paginated event table
- Click to expand AlertDetail

#### [NEW] FenceConfig.jsx
Page wrapping FenceEditor with instructions and existing zone list.

#### [NEW] FaceGalleryPage.jsx
Page wrapping FaceGallery component.

---

### Layout

#### [NEW] Sidebar.jsx
Dark, narrow sidebar with icon + label navigation:
- Dashboard, Live Cameras, Alerts, Event History, Fence Configuration, Face Gallery
- Active route highlighted with cyan accent
- IBVAP logo/title at top
- Collapsible on smaller screens

#### [NEW] Layout.jsx
`<Sidebar> + <main>` shell. Wraps all pages.

---

### Design System

| Element | Specification |
|---|---|
| **Background** | `#0a0e17` (deep navy-black) |
| **Panel** | `#111827` with `border-gray-800` |
| **Card** | `#1a1f2e` |
| **Text primary** | `gray-100` |
| **Text secondary** | `gray-400` |
| **Accent** | `cyan-400` / `cyan-500` |
| **Critical** | `red-500` / `red-600` |
| **High** | `orange-500` |
| **Medium** | `amber-400` |
| **Low** | `emerald-500` |
| **Font** | Inter (system fallback) |
| **Border radius** | Minimal (`rounded`, `rounded-lg`) |

---

## Verification Plan

### Manual Verification
1. `npm install` + `npm run dev` — app starts without errors
2. All 6 pages render with proper empty/error states (backend not running)
3. Navigation between all pages works
4. Responsive layout on 1280px, 1920px, and 2560px widths
5. When backend is eventually connected: events populate, WebSocket events stream, camera data loads
6. FenceEditor polygon drawing works on a canvas
7. No console errors from missing optional fields
8. No hardcoded mock/fake data in production paths
