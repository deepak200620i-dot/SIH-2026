"""
IBVAP — FastAPI Security Dependencies
=======================================
Provides ``get_current_user`` and ``require_role`` for route-level RBAC.
"""

from __future__ import annotations

from typing import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.security.auth import decode_access_token
from src.security.models import Role, UserInDB

bearer_scheme = HTTPBearer(auto_error=False)


# ── Shared helpers (deduplication) ──────────────────────────────────────

def _extract_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    """Extract a Bearer token from header or query params."""
    if credentials is not None and credentials.credentials:
        return credentials.credentials
    if "token" in request.query_params:
        return request.query_params["token"]
    return None


async def _fetch_user_from_db(username: str) -> UserInDB | None:
    """Look up a user by username and return a UserInDB, or None."""
    from src.db.crud import get_user_by_username
    from src.db.database import get_db_pool

    pool = get_db_pool()
    async with pool.acquire() as conn:
        user_row = await get_user_by_username(conn, username)

    if not user_row:
        return None

    return UserInDB(
        id=user_row["id"],
        username=user_row["username"],
        password_hash=user_row["password_hash"],
        role=user_row["role"],
        is_active=user_row["is_active"],
        created_at=str(user_row["created_at"]) if user_row.get("created_at") else None,
    )


# ── Public dependencies ────────────────────────────────────────────────

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserInDB:
    """
    Extract and validate the Bearer JWT, then fetch the user from the DB.
    Returns a ``UserInDB`` instance or raises 401.
    """
    token_str = _extract_token(request, credentials)

    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated — Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    from jose import JWTError

    try:
        payload = decode_access_token(token_str)
        username: str | None = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired or invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await _fetch_user_from_db(username)

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is disabled")

    return user


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserInDB | None:
    """
    Optional authentication: extracts and validates the Bearer JWT or query param if present.
    Returns ``UserInDB`` if valid, otherwise ``None`` (without raising 401).
    """
    token_str = _extract_token(request, credentials)

    if not token_str:
        return None

    from jose import JWTError

    try:
        payload = decode_access_token(token_str)
        username: str | None = payload.get("sub")
        if not username:
            return None
    except JWTError:
        return None

    try:
        user = await _fetch_user_from_db(username)
        if not user or not user.is_active:
            return None
        return user
    except Exception:
        return None



def require_role(*roles: Role) -> Callable:
    """
    Dependency factory: returns a dependency that checks the current user's
    role is within the allowed set.

    Usage::

        @router.get("/admin-only")
        async def admin_only(user = Depends(require_role(Role.ADMIN))):
            ...
    """

    async def _role_checker(
        user: UserInDB = Depends(get_current_user),
    ) -> UserInDB:
        if user.role not in [r.value if isinstance(r, Role) else r for r in roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {[r.value for r in roles]}",
            )
        return user

    return _role_checker
