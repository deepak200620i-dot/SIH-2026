"""
IBVAP — Blockchain / Ledger Service Unit Tests
==============================================
Tests the ledger abstraction, LocalDemoLedger implementation,
record registration, deterministic record hashing, and tamper detection.

Run:
    python -m pytest tests/test_blockchain.py -v
"""

import os
import shutil
import tempfile
import pytest

from src.security.blockchain import local_adapter
from src.security.blockchain.local_adapter import LocalDemoLedger
from src.security.blockchain.service import get_ledger, register_event, get_record, verify_record


@pytest.fixture(autouse=True)
def isolated_ledger_file(monkeypatch):
    tmp_dir = tempfile.mkdtemp()
    tmp_file = os.path.join(tmp_dir, "test_ledger.json")
    monkeypatch.setattr(local_adapter, "LEDGER_DIR", tmp_dir)
    monkeypatch.setattr(local_adapter, "LEDGER_FILE", tmp_file)
    yield
    shutil.rmtree(tmp_dir, ignore_errors=True)


def test_local_demo_ledger_registration_and_get():
    ledger = LocalDemoLedger()
    assert ledger.PROVIDER_NAME == "LOCAL_DEMO"

    record = ledger.register_event(
        event_id=101,
        camera_id="cam_01",
        event_type="intrusion",
        severity="critical",
        timestamp="2026-09-02T10:00:00Z",
        evidence_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    )

    assert record["event_id"] == 101
    assert record["camera_id"] == "cam_01"
    assert "record_id" in record

    # Retrieve
    fetched = ledger.get_record(101)
    assert fetched is not None
    assert fetched["record_id"] == record["record_id"]
    assert fetched["event_type"] == "intrusion"


def test_local_demo_ledger_verify_valid():
    ledger = LocalDemoLedger()
    ledger.register_event(
        event_id=202,
        camera_id="cam_02",
        event_type="weapon_detected",
        severity="critical",
        timestamp="2026-09-02T11:00:00Z",
        evidence_sha256="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    )

    ver = ledger.verify_record(202)
    assert ver["status"] == "VERIFIED"
    assert ver["event_id"] == 202


def test_local_demo_ledger_verify_tampered():
    ledger = LocalDemoLedger()
    ledger.register_event(
        event_id=303,
        camera_id="cam_01",
        event_type="loitering",
        severity="medium",
        timestamp="2026-09-02T12:00:00Z",
        evidence_sha256="hash123",
    )

    # Tamper the ledger data on disk
    data = local_adapter._load_ledger()
    data["records"]["303"]["evidence_sha256"] = "tampered_hash_value"
    local_adapter._save_ledger(data)

    ver = ledger.verify_record(303)
    assert ver["status"] == "TAMPERED"


def test_service_facade():
    res = register_event(
        event_id=404,
        camera_id="cam_03",
        event_type="zone_violation",
        severity="high",
        timestamp="2026-09-02T13:00:00Z",
        evidence_sha256="sha256_mock_abc",
    )
    assert res["event_id"] == 404

    rec = get_record(404)
    assert rec is not None
    assert rec["camera_id"] == "cam_03"

    ver = verify_record(404)
    assert ver["status"] == "VERIFIED"
