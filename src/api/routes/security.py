"""
IBVAP — Security & Integrity Routes
=====================================
Audit logs, evidence integrity verification, ledger status.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException

from src.db.crud import get_event
from src.db.database import get_db
from src.security.audit import audit_log, get_audit_logs
from src.security.dependencies import get_current_user, require_role
from src.security.integrity import verify_evidence
from src.security.models import (
    AuditLogEntry,
    IntegrityResponse,
    LedgerRecord,
    Role,
    UserInDB,
)
from src.security.blockchain import service as ledger_service

router = APIRouter(prefix="/api/security", tags=["security"])


@router.get("/audit-logs")
async def list_audit_logs(
    limit: int = 50,
    offset: int = 0,
    action: Optional[str] = None,
    db=Depends(get_db),
    user: UserInDB = Depends(require_role(Role.ADMIN, Role.AUDITOR)),
):
    """Retrieve audit log entries (admin/auditor only)."""
    logs = await get_audit_logs(db, limit=limit, offset=offset, action_filter=action)
    return {"items": logs, "total": len(logs)}


@router.get("/events/{event_id}/integrity", response_model=IntegrityResponse)
async def check_integrity(
    event_id: int,
    db=Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    """Check SHA-256 integrity of an event's evidence file."""
    evt = await get_event(db, event_id)
    if not evt:
        raise HTTPException(status_code=404, detail="Event not found")

    return IntegrityResponse(
        event_id=event_id,
        evidence_sha256=evt.get("evidence_sha256"),
        integrity_status=evt.get("integrity_status", "PENDING"),
        snapshot_path=evt.get("snapshot"),
    )


@router.post("/events/{event_id}/verify", response_model=IntegrityResponse)
async def verify_event_integrity(
    event_id: int,
    db=Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    """Re-compute SHA-256 and compare with stored hash for tamper detection."""
    evt = await get_event(db, event_id)
    if not evt:
        raise HTTPException(status_code=404, detail="Event not found")

    snapshot = evt.get("snapshot")
    stored_hash = evt.get("evidence_sha256")
    status = verify_evidence(snapshot, stored_hash) if snapshot else "NOT_AVAILABLE"

    # Update DB
    await db.execute(
        "UPDATE events SET integrity_status = $1 WHERE id = $2", status, event_id
    )

    await audit_log(
        db, actor_user_id=user.id, action="INTEGRITY_VERIFY",
        target_type="event", target_id=str(event_id),
        result=status,
    )

    return IntegrityResponse(
        event_id=event_id,
        evidence_sha256=stored_hash,
        integrity_status=status,
        snapshot_path=snapshot,
    )


@router.get("/events/{event_id}/ledger", response_model=LedgerRecord)
async def get_ledger_status(
    event_id: int,
    db=Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    """Get the blockchain/ledger registration status for an event."""
    evt = await get_event(db, event_id)
    if not evt:
        raise HTTPException(status_code=404, detail="Event not found")

    record = ledger_service.get_record(event_id)
    return LedgerRecord(
        event_id=event_id,
        provider=evt.get("ledger_provider"),
        record_id=evt.get("ledger_record_id"),
        status=evt.get("ledger_status", "PENDING"),
        registered_at=record.get("registered_at") if record else None,
        on_chain_data=record,
    )


@router.post("/events/{event_id}/ledger/retry")
async def retry_ledger_registration(
    event_id: int,
    db=Depends(get_db),
    user: UserInDB = Depends(require_role(Role.ADMIN)),
):
    """Retry failed ledger registration (admin only)."""
    evt = await get_event(db, event_id)
    if not evt:
        raise HTTPException(status_code=404, detail="Event not found")

    sha = evt.get("evidence_sha256", "")
    if not sha:
        raise HTTPException(status_code=400, detail="No evidence hash available for this event")

    try:
        record = ledger_service.register_event(
            event_id=event_id,
            camera_id=evt.get("camera_id", "cam_01"),
            event_type=evt.get("event_type", ""),
            severity=evt.get("severity", ""),
            timestamp=evt.get("timestamp", ""),
            evidence_sha256=sha,
        )
        await db.execute(
            """UPDATE events SET ledger_provider=$1, ledger_record_id=$2, ledger_status='REGISTERED' WHERE id=$3""",
            ledger_service.get_provider_name(),
            record.get("record_id", ""),
            event_id,
        )
        await audit_log(
            db, actor_user_id=user.id, action="LEDGER_REGISTER",
            target_type="event", target_id=str(event_id), result="success",
        )
        return {"status": "REGISTERED", "record": record}
    except Exception as e:
        await db.execute(
            "UPDATE events SET ledger_status='FAILED' WHERE id=$1", event_id
        )
        raise HTTPException(status_code=500, detail=f"Ledger registration failed: {e}")
