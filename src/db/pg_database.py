"""
IBVAP — PostgreSQL Database (asyncpg)
======================================
Async connection pool using ``asyncpg`` with Supabase PostgreSQL.
Replaces the old aiosqlite-based database layer.
"""

from __future__ import annotations

import os
import ssl
import traceback

import asyncpg

# ── Module-level pool ──────────────────────────────────────────────────
_pool: asyncpg.Pool | None = None

# DDL statements executed idempotently on startup
_DDL = """
-- Events table with security columns
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
    -- Security columns
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

-- Ensure columns exist on pre-existing tables
ALTER TABLE events ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE events ADD COLUMN IF NOT EXISTS evidence_sha256 VARCHAR(64);
ALTER TABLE events ADD COLUMN IF NOT EXISTS integrity_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE events ADD COLUMN IF NOT EXISTS ledger_provider VARCHAR(50);
ALTER TABLE events ADD COLUMN IF NOT EXISTS ledger_record_id VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS ledger_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE events ADD COLUMN IF NOT EXISTS signed_payload TEXT;
ALTER TABLE fence_zones ADD COLUMN IF NOT EXISTS camera_id VARCHAR(50) DEFAULT 'all';


-- Cameras
CREATE TABLE IF NOT EXISTS cameras (
    id          VARCHAR(50) PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    source      VARCHAR(255) NOT NULL,
    status      VARCHAR(20) DEFAULT 'active',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Known Faces
CREATE TABLE IF NOT EXISTS known_faces (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    image_path  TEXT,
    embedding   BYTEA,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_known_faces_name ON known_faces(name);

-- Fence Zones
CREATE TABLE IF NOT EXISTS fence_zones (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    camera_id   VARCHAR(50) DEFAULT 'all',
    polygon     JSONB NOT NULL,
    severity    VARCHAR(20) DEFAULT 'high',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Users (Authentication)
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'operator',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Audit Logs
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
"""


async def init_db(database_url: str | None = None) -> asyncpg.Pool:
    """
    Create the asyncpg connection pool and run idempotent DDL.
    Stores pool in module-level ``_pool`` for retrieval by ``get_db_pool()``.
    """
    global _pool

    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    url = (
        database_url
        if (database_url and (database_url.startswith("postgres://") or database_url.startswith("postgresql://")))
        else os.getenv("DATABASE_URL", "")
    )
    if not url:
        raise RuntimeError(
            "DATABASE_URL not set. Provide a Supabase PostgreSQL connection string."
        )

    # Supabase requires SSL
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    print("[DB] Connecting to PostgreSQL...")
    _pool = await asyncpg.create_pool(
        url,
        min_size=2,
        max_size=10,
        ssl=ssl_ctx,
        command_timeout=30,
    )

    # Run DDL
    async with _pool.acquire() as conn:
        await conn.execute(_DDL)

    print("[DB] PostgreSQL connected — schema ready.")
    return _pool


async def seed_admin_user() -> None:
    """Seed the initial admin user if the users table is empty."""
    if _pool is None:
        return

    from src.security.auth import hash_password

    admin_password = os.getenv("IBVAP_ADMIN_PASSWORD", "Admin@123")

    async with _pool.acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM users")
        if count == 0:
            pw_hash = hash_password(admin_password)
            await conn.execute(
                """
                INSERT INTO users (username, password_hash, role, is_active)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (username) DO NOTHING
                """,
                "admin",
                pw_hash,
                "admin",
                True,
            )
            # Also seed a default operator
            op_hash = hash_password("operator123")
            await conn.execute(
                """
                INSERT INTO users (username, password_hash, role, is_active)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (username) DO NOTHING
                """,
                "operator",
                op_hash,
                "operator",
                True,
            )
            print("[DB] Seeded admin + operator users.")


async def seed_default_cameras() -> None:
<<<<<<< HEAD
    """No-op: default demo cameras are disabled so user starts with clean state."""
    pass
=======
    """Seed default cameras if cameras table is empty."""
    if _pool is None:
        return

    async with _pool.acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM cameras")
        if count == 0:
            cameras = [
                ("cam_01", "Border Gate Alpha (North)", "data/videos/test.mp4", "active"),
                ("cam_02", "Perimeter Fence East", "data/videos/perimeter.mp4", "active"),
                ("cam_03", "Vehicle Checkpoint South", "data/videos/checkpoint.mp4", "active"),
                ("cam_04", "Watchtower West", "data/videos/watchtower.mp4", "active"),
            ]
            for cam_id, name, source, status in cameras:
                await conn.execute(
                    """
                    INSERT INTO cameras (id, name, source, status)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    cam_id,
                    name,
                    source,
                    status,
                )
            print("[DB] Seeded default cameras.")
>>>>>>> 0619cfbfff345fe95b563eca2cf9d8abeaf856ea


def get_db_pool() -> asyncpg.Pool:
    """Return the module-level connection pool. Raises if not initialized."""
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_db() first.")
    return _pool


async def get_db():
    """
    FastAPI dependency — yields an asyncpg Connection from the pool.
    Usage: ``db = Depends(get_db)``
    """
    pool = get_db_pool()
    async with pool.acquire() as conn:
        yield conn


async def close_db() -> None:
    """Close the connection pool (called on app shutdown)."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        print("[DB] PostgreSQL pool closed.")
