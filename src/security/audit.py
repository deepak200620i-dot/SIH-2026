"""
IBVAP — Audit Logging
======================
Non-blocking audit trail for security-relevant actions.
Never logs passwords, tokens, private keys, or raw biometric data.
"""

from __future__ import annotations

import json
import traceback
from datetime import datetime, timezone
from typing import Any, Optional


async def audit_log(
    conn,
    *,
    actor_user_id: Optional[int] = None,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    result: str = "success",
    metadata: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> None:
    """
    Insert an audit log entry.  Never raises — failures are printed but
    do not interrupt the calling operation.
    """
    try:
        meta_json = json.dumps(metadata) if metadata else None
        await conn.execute(
            """
            INSERT INTO audit_logs
                (actor_user_id, action, target_type, target_id,
                 timestamp, result, metadata_json, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            actor_user_id,
            action,
            target_type,
            target_id,
            datetime.now(timezone.utc),
            result,
            meta_json,
            ip_address,
        )
    except Exception:
        # Audit must never crash the app
        print(f"[AUDIT] Failed to write audit log: {traceback.format_exc()}")


async def get_audit_logs(
    conn,
    *,
    limit: int = 50,
    offset: int = 0,
    action_filter: Optional[str] = None,
) -> list[dict[str, Any]]:
    """Retrieve audit log entries, newest first."""
    if action_filter:
        rows = await conn.fetch(
            """
            SELECT id, actor_user_id, action, target_type, target_id,
                   timestamp, result, metadata_json, ip_address
            FROM audit_logs
            WHERE action = $1
            ORDER BY timestamp DESC
            LIMIT $2 OFFSET $3
            """,
            action_filter,
            limit,
            offset,
        )
    else:
        rows = await conn.fetch(
            """
            SELECT id, actor_user_id, action, target_type, target_id,
                   timestamp, result, metadata_json, ip_address
            FROM audit_logs
            ORDER BY timestamp DESC
            LIMIT $1 OFFSET $2
            """,
            limit,
            offset,
        )

    result = []
    for r in rows:
        entry = dict(r)
        entry["timestamp"] = str(entry["timestamp"]) if entry["timestamp"] else None
        if entry.get("metadata_json") and isinstance(entry["metadata_json"], str):
            try:
                entry["metadata_json"] = json.loads(entry["metadata_json"])
            except Exception:
                pass
        result.append(entry)
    return result
