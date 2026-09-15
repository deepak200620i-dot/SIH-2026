"""
IBVAP — Evidence Integrity (SHA-256)
=====================================
Computes and verifies SHA-256 digests for evidence snapshot files.
"""

from __future__ import annotations

import hashlib
import os


def hash_evidence(filepath: str) -> str | None:
    """
    Compute SHA-256 of the exact file bytes.
    Returns hex digest string or None on failure.
    """
    try:
        sha = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha.update(chunk)
        return sha.hexdigest()
    except Exception as e:
        print(f"[INTEGRITY] Failed to hash {filepath}: {e}")
        return None


def verify_evidence(filepath: str, stored_hash: str) -> str:
    """
    Re-compute SHA-256 and compare with stored hash.
    Returns one of: 'VERIFIED', 'FAILED', 'NOT_AVAILABLE'.
    """
    if not stored_hash:
        return "NOT_AVAILABLE"
    if not os.path.isfile(filepath):
        return "NOT_AVAILABLE"

    current_hash = hash_evidence(filepath)
    if current_hash is None:
        return "NOT_AVAILABLE"

    return "VERIFIED" if current_hash == stored_hash else "FAILED"
