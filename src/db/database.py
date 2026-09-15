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

__all__ = [
    "init_db",
    "get_db",
    "get_db_connection",
    "get_db_pool",
    "close_db",
    "seed_admin_user",
    "seed_default_cameras",
]
