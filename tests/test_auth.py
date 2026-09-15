"""
IBVAP — Security & Authentication Unit Tests
=============================================
Tests password hashing (bcrypt), token creation/decoding (JWT HS256),
and role-based access control helpers.

Run:
    python -m pytest tests/test_auth.py -v
"""

from __future__ import annotations

from datetime import timedelta
import pytest
from jose import jwt, JWTError

from src.security.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    JWT_SECRET,
    JWT_ALGORITHM,
)
from src.security.models import Role, UserInDB


def test_password_hashing():
    plain = "SuperSecretPassword@123"
    hashed = hash_password(plain)

    assert hashed != plain
    assert verify_password(plain, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_create_and_decode_token():
    payload = {"sub": "test_operator", "role": "operator"}
    token = create_access_token(payload, expires_delta=timedelta(minutes=15))

    decoded = decode_access_token(token)
    assert decoded["sub"] == "test_operator"
    assert decoded["role"] == "operator"
    assert "exp" in decoded


def test_expired_token():
    payload = {"sub": "expired_user", "role": "operator"}
    # Token that expired 5 minutes ago
    expired_token = create_access_token(payload, expires_delta=timedelta(minutes=-5))

    with pytest.raises(JWTError):
        decode_access_token(expired_token)


def test_invalid_token_signature():
    payload = {"sub": "tampered_user", "role": "admin"}
    fake_token = jwt.encode(payload, "wrong-secret-key-123", algorithm="HS256")

    with pytest.raises(JWTError):
        decode_access_token(fake_token)


def test_role_enum():
    assert Role.ADMIN.value == "admin"
    assert Role.OPERATOR.value == "operator"
    assert Role.AUDITOR.value == "auditor"


@pytest.mark.asyncio
async def test_get_current_user_from_query_param(monkeypatch):
    from unittest.mock import AsyncMock, MagicMock
    from src.security.dependencies import get_current_user

    # Generate a valid token
    token = create_access_token({"sub": "admin", "role": "admin"})

    # Mock request with query param token
    request = MagicMock()
    request.query_params = {"token": token}

    # Mock DB user lookup
    fake_user = {
        "id": 1,
        "username": "admin",
        "password_hash": "hash",
        "role": "admin",
        "is_active": True,
        "created_at": None,
    }

    mock_pool = MagicMock()
    mock_conn = AsyncMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

    monkeypatch.setattr("src.db.database.get_db_pool", lambda: mock_pool)
    monkeypatch.setattr("src.db.crud.get_user_by_username", AsyncMock(return_value=fake_user))

    user = await get_current_user(request=request, credentials=None)
    assert user.username == "admin"
    assert user.role == "admin"

