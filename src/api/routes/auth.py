"""
IBVAP — Authentication Routes
===============================
Login, token refresh, and current user profile endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from src.db.database import get_db
from src.security.audit import audit_log
from src.security.auth import create_access_token, verify_password
from src.security.dependencies import get_current_user
from src.security.models import LoginRequest, LoginResponse, UserInDB, UserPublic
from src.db.crud import get_user_by_username

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, request: Request, db=Depends(get_db)):
    """Authenticate with username/password and receive a JWT."""
    user_row = await get_user_by_username(db, payload.username)
    client_ip = request.client.host if request.client else "unknown"

    if not user_row:
        await audit_log(
            db, action="LOGIN_FAILURE",
            target_type="user", target_id=payload.username,
            result="user_not_found", ip_address=client_ip,
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, user_row["password_hash"]):
        await audit_log(
            db, actor_user_id=user_row["id"], action="LOGIN_FAILURE",
            target_type="user", target_id=payload.username,
            result="bad_password", ip_address=client_ip,
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user_row.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = create_access_token({"sub": user_row["username"], "role": user_row["role"]})

    await audit_log(
        db, actor_user_id=user_row["id"], action="LOGIN_SUCCESS",
        target_type="user", target_id=payload.username,
        result="success", ip_address=client_ip,
    )

    return LoginResponse(
        access_token=token,
        role=user_row["role"],
        username=user_row["username"],
    )


@router.get("/me", response_model=UserPublic)
async def get_me(user: UserInDB = Depends(get_current_user)):
    """Return the current authenticated user profile."""
    return UserPublic(
        id=user.id,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
    )


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(user: UserInDB = Depends(get_current_user)):
    """Refresh the JWT for the current authenticated user."""
    token = create_access_token({"sub": user.username, "role": user.role.value})
    return LoginResponse(
        access_token=token,
        role=user.role.value,
        username=user.username,
    )
