"""
IBVAP — SQLite to PostgreSQL Migration Utility
================================================
One-time migration: reads data/ibvap.db and writes to Supabase PostgreSQL.
Does NOT delete the source SQLite database.

Usage:
    python scripts/migrate_sqlite_to_pg.py
"""

import asyncio
import json
import os
import sqlite3
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from src.db.pg_database import init_db, get_db_pool, close_db, seed_admin_user

SQLITE_PATH = "data/ibvap.db"
DATABASE_URL = os.getenv("DATABASE_URL", "")


def read_sqlite_table(cursor, table_name: str) -> tuple[list[str], list[tuple]]:
    """Read all rows from a SQLite table. Returns (column_names, rows)."""
    cursor.execute(f"SELECT * FROM {table_name}")
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    return columns, rows


async def migrate():
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set. Set it in .env")
        sys.exit(1)

    if not os.path.isfile(SQLITE_PATH):
        print(f"No SQLite database found at {SQLITE_PATH}. Nothing to migrate.")
        return

    # Connect to SQLite
    print(f"[MIGRATE] Reading from SQLite: {SQLITE_PATH}")
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    cursor = sqlite_conn.cursor()

    # Get existing tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cursor.fetchall() if r[0] != "sqlite_sequence"]
    print(f"[MIGRATE] Found SQLite tables: {tables}")

    # Connect to PostgreSQL and ensure schema
    print("[MIGRATE] Initializing PostgreSQL schema...")
    pool = await init_db(DATABASE_URL)
    print("[MIGRATE] Connected to PostgreSQL schema.")

    async with pool.acquire() as pg_conn:
        # Migrate each table
        for table in tables:
            columns, rows = read_sqlite_table(cursor, table)
            if not rows:
                print(f"  [{table}] — empty, skipping")
                continue

            print(f"  [{table}] — {len(rows)} rows, columns: {columns}")

            for row_tuple in rows:
                row = dict(zip(columns, row_tuple))

                if table == "events":
                    # Map SQLite columns to PostgreSQL
                    bbox_val = row.get("bbox")
                    if bbox_val and isinstance(bbox_val, str):
                        try:
                            bbox_val = json.loads(bbox_val)
                        except Exception:
                            pass
                    meta_val = row.get("metadata")
                    if meta_val and isinstance(meta_val, str):
                        try:
                            meta_val = json.loads(meta_val)
                        except Exception:
                            pass

                    ts_str = row.get("timestamp")
                    if ts_str:
                        try:
                            from datetime import datetime, timezone
                            ts_val = datetime.fromisoformat(ts_str)
                        except Exception:
                            ts_val = datetime.now(timezone.utc)
                    else:
                        from datetime import datetime, timezone
                        ts_val = datetime.now(timezone.utc)

                    try:
                        await pg_conn.execute(
                            """
                            INSERT INTO events (timestamp, event_type, severity, camera_id,
                                track_id, class_name, zone_name, face_name, plate_text,
                                confidence, bbox, snapshot, metadata, status)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13::jsonb, $14)
                            ON CONFLICT DO NOTHING
                            """,
                            ts_val,
                            row.get("event_type", ""),
                            row.get("severity", "medium"),
                            row.get("camera_id", "cam_01"),
                            row.get("track_id"),
                            row.get("class_name"),
                            row.get("zone_name"),
                            row.get("face_name"),
                            row.get("plate_text"),
                            row.get("confidence"),
                            json.dumps(bbox_val) if bbox_val else None,
                            row.get("snapshot"),
                            json.dumps(meta_val) if meta_val else None,
                            row.get("status", "ACTIVE"),
                        )
                    except Exception as e:
                        print(f"    [WARN] Failed to migrate event row: {e}")

                elif table == "cameras":
                    try:
                        await pg_conn.execute(
                            """
                            INSERT INTO cameras (id, name, source, status)
                            VALUES ($1, $2, $3, $4)
                            ON CONFLICT (id) DO NOTHING
                            """,
                            row.get("id", ""),
                            row.get("name", ""),
                            row.get("source", ""),
                            row.get("status", "active"),
                        )
                    except Exception as e:
                        print(f"    [WARN] Failed to migrate camera row: {e}")

                elif table == "known_faces":
                    try:
                        await pg_conn.execute(
                            """
                            INSERT INTO known_faces (name, image_path, embedding)
                            VALUES ($1, $2, $3)
                            """,
                            row.get("name", ""),
                            row.get("image_path"),
                            row.get("embedding"),
                        )
                    except Exception as e:
                        print(f"    [WARN] Failed to migrate face row: {e}")

                elif table == "fence_zones":
                    polygon = row.get("polygon")
                    if polygon and isinstance(polygon, str):
                        pass  # keep as string for jsonb cast
                    else:
                        polygon = json.dumps(polygon) if polygon else "[]"
                    try:
                        await pg_conn.execute(
                            """
                            INSERT INTO fence_zones (name, polygon, severity)
                            VALUES ($1, $2::jsonb, $3)
                            ON CONFLICT (name) DO NOTHING
                            """,
                            row.get("name", ""),
                            polygon,
                            row.get("severity", "high"),
                        )
                    except Exception as e:
                        print(f"    [WARN] Failed to migrate zone row: {e}")

        # Verify counts
        print("\n[MIGRATE] Verification:")
        for table in ["events", "cameras", "known_faces", "fence_zones"]:
            try:
                sqlite_count = cursor.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            except Exception:
                sqlite_count = "N/A"
            try:
                pg_count = await pg_conn.fetchval(f"SELECT COUNT(*) FROM {table}")
            except Exception:
                pg_count = "N/A"
            print(f"  {table}: SQLite={sqlite_count}  PostgreSQL={pg_count}")

    # Seed admin user
    await seed_admin_user()

    await close_db()
    sqlite_conn.close()
    print("\n[MIGRATE] Migration complete. Source SQLite NOT deleted.")


if __name__ == "__main__":
    asyncio.run(migrate())
