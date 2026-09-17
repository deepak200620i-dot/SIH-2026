-- ========================================================================
-- IBVAP — Intelligent Border Video Analytics Platform
-- Supabase PostgreSQL Database Schema (v2.0 — Security + Blockchain)
-- ========================================================================

-- 1. Events Table (with security columns)
CREATE TABLE IF NOT EXISTS events (
    id          BIGSERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type  VARCHAR(50) NOT NULL,
    severity    VARCHAR(20) NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
CREATE INDEX IF NOT EXISTS idx_events_camera_id ON events(camera_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- 2. Cameras Table
CREATE TABLE IF NOT EXISTS cameras (
    id          VARCHAR(50) PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    source      VARCHAR(255) NOT NULL,
    status      VARCHAR(20) DEFAULT 'active',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Known Faces Table
CREATE TABLE IF NOT EXISTS known_faces (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    image_path  TEXT,
    embedding   BYTEA,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_known_faces_name ON known_faces(name);

-- 4. Fence Zones Table
CREATE TABLE IF NOT EXISTS fence_zones (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    camera_id   VARCHAR(50) DEFAULT 'all',
    polygon     JSONB NOT NULL,
    severity    VARCHAR(20) DEFAULT 'high',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

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
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE known_faces ENABLE ROW LEVEL SECURITY;
ALTER TABLE fence_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Service-role full access policies
CREATE POLICY "Service role events" ON events FOR ALL USING (true);
CREATE POLICY "Service role cameras" ON cameras FOR ALL USING (true);
CREATE POLICY "Service role known_faces" ON known_faces FOR ALL USING (true);
CREATE POLICY "Service role fence_zones" ON fence_zones FOR ALL USING (true);
CREATE POLICY "Service role users" ON users FOR ALL USING (true);
CREATE POLICY "Service role audit_logs" ON audit_logs FOR ALL USING (true);
