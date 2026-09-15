"""
IBVAP — Migration Utility Unit Tests
====================================
Tests SQLite table reading, column parsing, and data validation logic.

Run:
    python -m pytest tests/test_migration.py -v
"""

import json
import sqlite3
import tempfile
import os
import pytest

from scripts.migrate_sqlite_to_pg import read_sqlite_table


@pytest.fixture
def mock_sqlite_db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    conn = sqlite3.connect(path)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE test_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            event_type TEXT,
            bbox TEXT,
            metadata TEXT
        )
        """
    )
    cur.execute(
        """
        INSERT INTO test_events (timestamp, event_type, bbox, metadata)
        VALUES ('2026-09-02T10:00:00Z', 'intrusion', '[10, 20, 30, 40]', '{"confidence": 0.95}')
        """
    )
    conn.commit()
    conn.close()

    yield path

    if os.path.exists(path):
        os.remove(path)


def test_read_sqlite_table(mock_sqlite_db):
    conn = sqlite3.connect(mock_sqlite_db)
    cur = conn.cursor()

    columns, rows = read_sqlite_table(cur, "test_events")
    assert "id" in columns
    assert "timestamp" in columns
    assert "bbox" in columns
    assert len(rows) == 1

    row_dict = dict(zip(columns, rows[0]))
    assert row_dict["event_type"] == "intrusion"

    # Verify JSON deserialization works
    bbox = json.loads(row_dict["bbox"])
    assert bbox == [10, 20, 30, 40]

    metadata = json.loads(row_dict["metadata"])
    assert metadata["confidence"] == 0.95

    conn.close()
