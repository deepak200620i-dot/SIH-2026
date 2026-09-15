-- ========================================================================
-- IBVAP — Intelligent Border Video Analytics Platform
<<<<<<< HEAD
-- Supabase PostgreSQL Database Schema
-- ========================================================================

-- 1. Create Events Table
CREATE TABLE IF NOT EXISTS events (
    id          BIGSERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type  VARCHAR(50) NOT NULL, -- intrusion, face_match, face_unknown, anpr, loitering
    severity    VARCHAR(20) NOT NULL, -- low, medium, high, critical
=======
-- Supabase PostgreSQL Database Schema (v2.0 — Security + Blockchain)
-- ========================================================================

-- 1. Events Table (with security columns)
CREATE TABLE IF NOT EXISTS events (
    id          BIGSERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type  VARCHAR(50) NOT NULL,
    severity    VARCHAR(20) NOT NULL,
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
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
<<<<<<< HEAD
    status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- active, acknowledged, investigating, resolved
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning fast event queries and dashboard analytics
=======
    status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    -- Security & Integrity columns
    evidence_sha256   VARCHAR(64),
    integrity_status  VARCHAR(20) DEFAULT 'PENDING',
    ledger_provider   VARCHAR(50),
    ledger_record_id  VARCHAR(100),
    ledger_status     VARCHAR(20) DEFAULT 'PENDING',
    signed_payload    TEXT
);

>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
CREATE INDEX IF NOT EXISTS idx_events_camera_id ON events(camera_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

<<<<<<< HEAD
-- 2. Create Cameras Table
=======
-- 2. Cameras Table
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
CREATE TABLE IF NOT EXISTS cameras (
    id          VARCHAR(50) PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    source      VARCHAR(255) NOT NULL,
<<<<<<< HEAD
    status      VARCHAR(20) DEFAULT 'active', -- active, offline, degraded
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Known Faces Table
=======
    status      VARCHAR(20) DEFAULT 'active',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Known Faces Table
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
CREATE TABLE IF NOT EXISTS known_faces (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    image_path  TEXT,
    embedding   BYTEA,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
<<<<<<< HEAD

CREATE INDEX IF NOT EXISTS idx_known_faces_name ON known_faces(name);

-- 4. Create Fence Zones Table (Optional persistence for zones)
CREATE TABLE IF NOT EXISTS fence_zones (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
=======
CREATE INDEX IF NOT EXISTS idx_known_faces_name ON known_faces(name);

-- 4. Fence Zones Table
CREATE TABLE IF NOT EXISTS fence_zones (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    camera_id   VARCHAR(50) DEFAULT 'all',
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
    polygon     JSONB NOT NULL,
    severity    VARCHAR(20) DEFAULT 'high',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

<<<<<<< HEAD
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


-- Enable Row Level Security (RLS) if required by Supabase policies
=======
-- 5. Users Table (Authentication & RBAC)
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'operator',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 6. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    actor_user_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(50) NOT NULL,
    target_type     VARCHAR(50),
    target_id       VARCHAR(100),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    result          VARCHAR(50),
    metadata_json   TEXT,
    ip_address      VARCHAR(45)
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ========================================================================
-- Seed Initial Data
-- ========================================================================

-- (Default demo cameras and fence zones removed per requirements)


-- ========================================================================
-- Row Level Security (RLS)
-- ========================================================================
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE known_faces ENABLE ROW LEVEL SECURITY;
ALTER TABLE fence_zones ENABLE ROW LEVEL SECURITY;
<<<<<<< HEAD

-- Allow public read access (or customize for authenticated users)
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Public insert events" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read cameras" ON cameras FOR SELECT USING (true);
CREATE POLICY "Public insert/update cameras" ON cameras FOR ALL USING (true);
CREATE POLICY "Public read known_faces" ON known_faces FOR SELECT USING (true);
CREATE POLICY "Public write known_faces" ON known_faces FOR ALL USING (true);
CREATE POLICY "Public read fence_zones" ON fence_zones FOR SELECT USING (true);
CREATE POLICY "Public write fence_zones" ON fence_zones FOR ALL USING (true);
=======
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Service-role full access policies
CREATE POLICY "Service role events" ON events FOR ALL USING (true);
CREATE POLICY "Service role cameras" ON cameras FOR ALL USING (true);
CREATE POLICY "Service role known_faces" ON known_faces FOR ALL USING (true);
CREATE POLICY "Service role fence_zones" ON fence_zones FOR ALL USING (true);
CREATE POLICY "Service role users" ON users FOR ALL USING (true);
CREATE POLICY "Service role audit_logs" ON audit_logs FOR ALL USING (true);
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
