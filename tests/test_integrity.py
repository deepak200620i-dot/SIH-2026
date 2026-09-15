"""
IBVAP — Evidence Integrity Unit Tests
======================================
Tests SHA-256 evidence hashing, tamper detection, and verification states.

Run:
    python -m pytest tests/test_integrity.py -v
"""

import os
import tempfile
import pytest

from src.security.integrity import hash_evidence, verify_evidence


def test_hash_evidence_success():
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as f:
        f.write(b"fake image bytes 1234567890")
        f_path = f.name

    try:
        digest = hash_evidence(f_path)
        assert digest is not None
        assert len(digest) == 64  # SHA-256 hex length
    finally:
        if os.path.exists(f_path):
            os.remove(f_path)


def test_hash_evidence_missing_file():
    digest = hash_evidence("non_existent_file_path_xyz.jpg")
    assert digest is None


def test_verify_evidence_matched():
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as f:
        f.write(b"secure evidence file contents")
        f_path = f.name

    try:
        original_hash = hash_evidence(f_path)
        assert original_hash is not None

        status = verify_evidence(f_path, original_hash)
        assert status == "VERIFIED"
    finally:
        if os.path.exists(f_path):
            os.remove(f_path)


def test_verify_evidence_tampered():
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as f:
        f.write(b"original evidence bytes")
        f_path = f.name

    try:
        original_hash = hash_evidence(f_path)
        assert original_hash is not None

        # Tamper the file
        with open(f_path, "wb") as f:
            f.write(b"tampered evidence bytes")

        status = verify_evidence(f_path, original_hash)
        assert status == "FAILED"
    finally:
        if os.path.exists(f_path):
            os.remove(f_path)


def test_verify_evidence_not_available():
    # Empty hash
    assert verify_evidence("some_file.jpg", "") == "NOT_AVAILABLE"
    # Missing file
    assert verify_evidence("does_not_exist_file.jpg", "abcdef123456") == "NOT_AVAILABLE"
