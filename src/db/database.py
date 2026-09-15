"""
IBVAP — Database Interface
===========================
Compatibility shim: all public APIs now delegate to ``pg_database``
(asyncpg / PostgreSQL).  The old aiosqlite layer has been replaced.
"""

from __future__ import annotations

# Re-export everything from the new PostgreSQL module
from src.db.pg_database import (
    close_db,
    get_db,
    get_db_pool,
    init_db,
    seed_admin_user,
    seed_default_cameras,
)

# Backward compatibility alias for legacy tests
get_db_connection = get_db

<<<<<<< HEAD
DEFAULT_DB_PATH = "data/ibvap.db"


def load_db_path_from_config(config_path: str = "config/settings.yaml") -> str:
    """Load database path from settings.yaml if available."""
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = yaml.safe_load(f) or {}
                return cfg.get("events", {}).get("db_path", DEFAULT_DB_PATH)
        except Exception:
            pass
    return DEFAULT_DB_PATH


async def get_db_connection(db_path: Optional[str] = None) -> aiosqlite.Connection:
    """Open and return an async SQLite connection with Row factory enabled."""
    path = db_path or load_db_path_from_config()
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    db = await aiosqlite.connect(path)
    db.row_factory = aiosqlite.Row
    return db


async def init_db(db_path: Optional[str] = None) -> None:
    """Initialize database tables and insert default records."""
    db = await get_db_connection(db_path)
    try:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp   TEXT    NOT NULL,
                event_type  TEXT    NOT NULL,
                severity    TEXT    NOT NULL,
                camera_id   TEXT    DEFAULT 'cam_01',
                track_id    INTEGER,
                class_name  TEXT,
                zone_name   TEXT,
                face_name   TEXT,
                plate_text  TEXT,
                confidence  REAL,
                bbox        TEXT,
                snapshot    TEXT,
                metadata    TEXT,
                status      TEXT    DEFAULT 'ACTIVE',
                created_at  TEXT    DEFAULT (datetime('now'))
            )
        """)

        # Support databases created before event acknowledgement was added.
        cursor = await db.execute("PRAGMA table_info(events)")
        columns = {row[1] for row in await cursor.fetchall()}
        if "status" not in columns:
            await db.execute("ALTER TABLE events ADD COLUMN status TEXT DEFAULT 'ACTIVE'")

        await db.execute("""
            CREATE TABLE IF NOT EXISTS cameras (
                id          TEXT    PRIMARY KEY,
                name        TEXT    NOT NULL,
                source      TEXT    NOT NULL,
                status      TEXT    DEFAULT 'active',
                created_at  TEXT    DEFAULT (datetime('now'))
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS known_faces (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                image_path  TEXT,
                embedding   BLOB,
                created_at  TEXT    DEFAULT (datetime('now'))
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS fence_zones (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    UNIQUE NOT NULL,
                camera_id   TEXT    DEFAULT 'all',
                polygon     TEXT    NOT NULL,
                severity    TEXT    DEFAULT 'high',
                created_at  TEXT    DEFAULT (datetime('now'))
            )
        """)

        # Insert default camera if empty
        cursor = await db.execute("SELECT COUNT(*) FROM cameras")
        count = (await cursor.fetchone())[0]
        if count == 0:
            await db.execute(
                "INSERT INTO cameras (id, name, source, status) VALUES (?, ?, ?, ?)",
                ("cam_01", "Border Gate Alpha", "data/videos/test.mp4", "active")
            )

        await db.commit()
    finally:
        await db.close()


async def get_db(db_path: Optional[str] = None) -> AsyncGenerator[aiosqlite.Connection, None]:
    """Dependency generator for FastAPI endpoints."""
    db = await get_db_connection(db_path)
    try:
        yield db
    finally:
        await db.close()
=======
__all__ = [
    "init_db",
    "get_db",
    "get_db_connection",
    "get_db_pool",
    "close_db",
    "seed_admin_user",
    "seed_default_cameras",
]
>>>>>>> 31c5f44e9caa22f979b450929276656e6146cd3b
