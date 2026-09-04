-- ========================================================================
-- IBVAP — Intelligent Border Video Analytics Platform
-- Supabase PostgreSQL Database Schema
-- ========================================================================

-- 1. Create Events Table
CREATE TABLE IF NOT EXISTS events (
    id          BIGSERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type  VARCHAR(50) NOT NULL, -- intrusion, face_match, face_unknown, anpr, loitering
    severity    VARCHAR(20) NOT NULL, -- low, medium, high, critical
    camera_id   VARCHAR(50) DEFAULT 'cam_01',
    track_id    INTEGER,
    class_name  VARCHAR(50),
    zone_name   VARCHAR(100),
    face_name   VARCHAR(100),
    plate_text  VARCHAR(30),
    confidence  REAL,
    bbox        JSONB,
    snapshot    TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning fast event queries and dashboard analytics
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
CREATE INDEX IF NOT EXISTS idx_events_camera_id ON events(camera_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- 2. Create Cameras Table
CREATE TABLE IF NOT EXISTS cameras (
    id          VARCHAR(50) PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    source      VARCHAR(255) NOT NULL,
    status      VARCHAR(20) DEFAULT 'active', -- active, offline, degraded
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Known Faces Table
CREATE TABLE IF NOT EXISTS known_faces (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    image_path  TEXT,
    embedding   BYTEA,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_known_faces_name ON known_faces(name);

-- 4. Create Fence Zones Table (Optional persistence for zones)
CREATE TABLE IF NOT EXISTS fence_zones (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    polygon     JSONB NOT NULL,
    severity    VARCHAR(20) DEFAULT 'high',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================================
-- Seed Initial Sample Data
-- ========================================================================

-- Default Cameras
INSERT INTO cameras (id, name, source, status)
VALUES 
    ('cam_01', 'Border Gate Alpha (North)', 'data/videos/test.mp4', 'active'),
    ('cam_02', 'Perimeter Fence East', 'data/videos/perimeter.mp4', 'active'),
    ('cam_03', 'Vehicle Checkpoint South', 'data/videos/checkpoint.mp4', 'active'),
    ('cam_04', 'Watchtower West', 'data/videos/watchtower.mp4', 'active')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    source = EXCLUDED.source,
    status = EXCLUDED.status;

-- Default Fence Zones
INSERT INTO fence_zones (name, polygon, severity)
VALUES
    ('restricted_area_1', '[[100, 100], [400, 100], [400, 400], [100, 400]]'::jsonb, 'high'),
    ('perimeter_zone', '[[0, 300], [640, 300], [640, 480], [0, 480]]'::jsonb, 'critical')
ON CONFLICT (name) DO NOTHING;

-- Sample Starting Events
INSERT INTO events (timestamp, event_type, severity, camera_id, track_id, class_name, zone_name, confidence, metadata)
VALUES
    (NOW() - INTERVAL '5 minutes', 'intrusion', 'critical', 'cam_01', 101, 'person', 'perimeter_zone', 0.94, '{"zone_type": "border_fence"}'::jsonb),
    (NOW() - INTERVAL '12 minutes', 'loitering', 'high', 'cam_01', 102, 'person', 'restricted_area_1', 0.89, '{"dwell_time_seconds": 72.5}'::jsonb),
    (NOW() - INTERVAL '25 minutes', 'face_match', 'medium', 'cam_01', 103, 'person', NULL, 0.92, '{"matched_face": "john_doe"}'::jsonb),
    (NOW() - INTERVAL '40 minutes', 'anpr', 'medium', 'cam_03', 104, 'car', NULL, 0.96, '{"plate": "DL01AB1234"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (RLS) if required by Supabase policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE known_faces ENABLE ROW LEVEL SECURITY;
ALTER TABLE fence_zones ENABLE ROW LEVEL SECURITY;

-- Allow public read access (or customize for authenticated users)
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Public insert events" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read cameras" ON cameras FOR SELECT USING (true);
CREATE POLICY "Public insert/update cameras" ON cameras FOR ALL USING (true);
CREATE POLICY "Public read known_faces" ON known_faces FOR SELECT USING (true);
CREATE POLICY "Public write known_faces" ON known_faces FOR ALL USING (true);
CREATE POLICY "Public read fence_zones" ON fence_zones FOR SELECT USING (true);
CREATE POLICY "Public write fence_zones" ON fence_zones FOR ALL USING (true);
