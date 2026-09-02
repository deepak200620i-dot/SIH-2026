"""
IBVAP — Database Connection & Schema Management
===============================================
Async SQLite database connection management using aiosqlite.
Initializes database tables (events, cameras, known_faces).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import AsyncGenerator, Optional

import aiosqlite
import yaml

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
                created_at  TEXT    DEFAULT (datetime('now'))
            )
        """)

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
