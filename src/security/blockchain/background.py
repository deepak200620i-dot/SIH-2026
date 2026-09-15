"""
IBVAP — Background Ledger Registration
========================================
Non-blocking async task that registers events on the ledger
after they are committed to PostgreSQL and broadcast via WebSocket.
Never blocks the real-time YOLO/ByteTrack pipeline.
"""

from __future__ import annotations

import asyncio
import traceback
from typing import Any


async def background_ledger_register(
    pool,
    event_id: int,
    camera_id: str,
    event_type: str,
    severity: str,
    timestamp: str,
    evidence_sha256: str | None,
) -> None:
    """
    Register an event on the ledger in the background.
    Updates PostgreSQL with the ledger status afterwards.
    """
    from src.security.blockchain import service as ledger_service

    if not evidence_sha256:
        # No evidence hash — mark as not applicable
        try:
            async with pool.acquire() as conn:
                await conn.execute(
                    "UPDATE events SET ledger_status = $1 WHERE id = $2",
                    "NOT_APPLICABLE",
                    event_id,
                )
        except Exception:
            pass
        return

    try:
        # Run ledger registration in executor to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        record = await loop.run_in_executor(
            None,
            lambda: ledger_service.register_event(
                event_id=event_id,
                camera_id=camera_id,
                event_type=event_type,
                severity=severity,
                timestamp=timestamp,
                evidence_sha256=evidence_sha256,
            ),
        )

        # Update DB with ledger registration result
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE events
                SET ledger_provider = $1,
                    ledger_record_id = $2,
                    ledger_status = 'REGISTERED'
                WHERE id = $3
                """,
                ledger_service.get_provider_name(),
                record.get("record_id", ""),
                event_id,
            )

    except Exception as exc:
        print(f"[LEDGER] Background registration failed for event {event_id}: {exc}")
        traceback.print_exc()
        try:
            async with pool.acquire() as conn:
                await conn.execute(
                    "UPDATE events SET ledger_status = 'FAILED' WHERE id = $1",
                    event_id,
                )
        except Exception:
            pass


def enqueue_ledger_registration(
    pool,
    event_id: int,
    camera_id: str,
    event_type: str,
    severity: str,
    timestamp: str,
    evidence_sha256: str | None,
) -> None:
    """
    Fire-and-forget: schedule ledger registration as a background task.
    Does NOT await — the real-time pipeline continues immediately.
    """
    try:
        loop = asyncio.get_event_loop()
        loop.create_task(
            background_ledger_register(
                pool=pool,
                event_id=event_id,
                camera_id=camera_id,
                event_type=event_type,
                severity=severity,
                timestamp=timestamp,
                evidence_sha256=evidence_sha256,
            )
        )
    except RuntimeError:
        # No running event loop — skip silently (e.g. during tests)
        pass
