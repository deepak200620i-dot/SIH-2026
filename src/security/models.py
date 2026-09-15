"""
IBVAP — Security Pydantic Models
=================================
Data models for authentication, RBAC, tokens, and audit logging.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Roles ──────────────────────────────────────────────────────────────
class Role(str, Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    AUDITOR = "auditor"


# ── User ───────────────────────────────────────────────────────────────
class UserInDB(BaseModel):
    id: int
    username: str
    password_hash: str
    role: Role
    is_active: bool = True
    created_at: Optional[str] = None


class UserPublic(BaseModel):
    id: int
    username: str
    role: Role
    is_active: bool


# ── Auth Requests / Responses ──────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=200)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


class TokenData(BaseModel):
    username: str
    role: str
    exp: Optional[float] = None


# ── Integrity ──────────────────────────────────────────────────────────
class IntegrityStatus(str, Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    NOT_AVAILABLE = "NOT_AVAILABLE"


class IntegrityResponse(BaseModel):
    event_id: int
    evidence_sha256: Optional[str] = None
    integrity_status: str
    snapshot_path: Optional[str] = None


# ── Ledger ─────────────────────────────────────────────────────────────
class LedgerStatus(str, Enum):
    PENDING = "PENDING"
    REGISTERED = "REGISTERED"
    FAILED = "FAILED"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class LedgerRecord(BaseModel):
    event_id: int
    provider: Optional[str] = None
    record_id: Optional[str] = None
    status: str
    registered_at: Optional[str] = None
    on_chain_data: Optional[dict] = None


# ── Audit ──────────────────────────────────────────────────────────────
class AuditAction(str, Enum):
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILURE = "LOGIN_FAILURE"
    VIEW_EVIDENCE = "VIEW_EVIDENCE"
    ACKNOWLEDGE_EVENT = "ACKNOWLEDGE_EVENT"
    MODIFY_ZONE = "MODIFY_ZONE"
    ADD_CAMERA = "ADD_CAMERA"
    REMOVE_CAMERA = "REMOVE_CAMERA"
    FACE_ENROLL = "FACE_ENROLL"
    FACE_DELETE = "FACE_DELETE"
    INTEGRITY_VERIFY = "INTEGRITY_VERIFY"
    LEDGER_REGISTER = "LEDGER_REGISTER"
    ADMIN_ACTION = "ADMIN_ACTION"


class AuditLogEntry(BaseModel):
    id: int
    actor_username: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    timestamp: str
    result: Optional[str] = None
    metadata_json: Optional[dict] = None
    ip_address: Optional[str] = None
