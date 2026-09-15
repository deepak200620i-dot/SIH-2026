"""
IBVAP — Ledger Service Facade
===============================
Single entry point for ledger operations.  Selects the adapter based
on the ``LEDGER_PROVIDER`` environment variable.
"""

from __future__ import annotations

import os
from typing import Any, Optional

from src.security.blockchain.local_adapter import LocalDemoLedger


def _get_adapter():
    """Return the configured ledger adapter instance."""
    provider = os.getenv("LEDGER_PROVIDER", "LOCAL_DEMO").upper()
    if provider == "HYPERLEDGER_FABRIC":
        from src.security.blockchain.fabric_adapter import HyperledgerFabricAdapter
        return HyperledgerFabricAdapter()
    # Default: local demo
    return LocalDemoLedger()


# Module-level singleton (lazy)
_adapter = None


def get_ledger():
    global _adapter
    if _adapter is None:
        _adapter = _get_adapter()
    return _adapter


def register_event(
    event_id: int,
    camera_id: str,
    event_type: str,
    severity: str,
    timestamp: str,
    evidence_sha256: str,
) -> dict[str, Any]:
    """Register an event on the configured ledger."""
    return get_ledger().register_event(
        event_id=event_id,
        camera_id=camera_id,
        event_type=event_type,
        severity=severity,
        timestamp=timestamp,
        evidence_sha256=evidence_sha256,
    )


def get_record(event_id: int) -> Optional[dict[str, Any]]:
    """Retrieve a ledger record."""
    return get_ledger().get_record(event_id)


def verify_record(event_id: int) -> dict[str, Any]:
    """Verify a ledger record."""
    return get_ledger().verify_record(event_id)


def get_provider_name() -> str:
    """Return the active provider name."""
    return get_ledger().PROVIDER_NAME
