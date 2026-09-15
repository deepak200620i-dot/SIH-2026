"""
IBVAP — Local Demo Ledger
===========================
Deterministic, file-backed demo ledger.
Clearly labeled as LOCAL DEMO — never represents itself as blockchain.
Stores records in ``data/ledger/local_demo_ledger.json``.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any, Optional


LEDGER_DIR = "data/ledger"
LEDGER_FILE = os.path.join(LEDGER_DIR, "local_demo_ledger.json")


def _load_ledger() -> dict[str, Any]:
    if os.path.isfile(LEDGER_FILE):
        with open(LEDGER_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"records": {}, "chain_tip": "genesis"}


def _save_ledger(data: dict[str, Any]) -> None:
    os.makedirs(LEDGER_DIR, exist_ok=True)
    with open(LEDGER_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)


def _deterministic_id(event_id: int, evidence_sha256: str, timestamp: str) -> str:
    """Generate a deterministic record ID from event data hash."""
    payload = f"{event_id}:{evidence_sha256}:{timestamp}"
    return hashlib.sha256(payload.encode()).hexdigest()[:24]


class LocalDemoLedger:
    """
    LOCAL DEMO LEDGER — file-backed, deterministic.
    NOT a blockchain. Suitable for demonstration and development only.
    """

    PROVIDER_NAME = "LOCAL_DEMO"

    def register_event(
        self,
        event_id: int,
        camera_id: str,
        event_type: str,
        severity: str,
        timestamp: str,
        evidence_sha256: str,
    ) -> dict[str, Any]:
        """Register an event hash on the local demo ledger."""
        ledger = _load_ledger()
        record_id = _deterministic_id(event_id, evidence_sha256 or "", timestamp)

        record = {
            "record_id": record_id,
            "event_id": event_id,
            "camera_id": camera_id,
            "event_type": event_type,
            "severity": severity,
            "timestamp": timestamp,
            "evidence_sha256": evidence_sha256,
            "registered_at": datetime.now(timezone.utc).isoformat(),
            "previous_tip": ledger["chain_tip"],
        }

        ledger["records"][str(event_id)] = record
        ledger["chain_tip"] = record_id
        _save_ledger(ledger)

        return record

    def get_record(self, event_id: int) -> Optional[dict[str, Any]]:
        """Retrieve a ledger record by event ID."""
        ledger = _load_ledger()
        return ledger["records"].get(str(event_id))

    def verify_record(self, event_id: int) -> dict[str, Any]:
        """Verify a record exists and is consistent."""
        record = self.get_record(event_id)
        if record is None:
            return {"status": "NOT_FOUND", "event_id": event_id}

        # Re-derive the record ID to verify consistency
        expected_id = _deterministic_id(
            record["event_id"],
            record.get("evidence_sha256", ""),
            record["timestamp"],
        )
        is_valid = expected_id == record["record_id"]
        return {
            "status": "VERIFIED" if is_valid else "TAMPERED",
            "event_id": event_id,
            "record_id": record["record_id"],
            "registered_at": record.get("registered_at"),
        }
