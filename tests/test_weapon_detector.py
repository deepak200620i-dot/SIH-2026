"""Tests for weapon-alert configuration and critical-event policy."""

from __future__ import annotations

from src.detection.weapon_detector import WeaponDetector
from src.rules.event_engine import EventEngine


def test_weapon_labels_normalise_to_detector_convention() -> None:
    assert WeaponDetector._normalise("Rocket Launcher") == "rocket_launcher"
    assert WeaponDetector._normalise("ASSAULT-RIFLE") == "assault_rifle"


def test_weapon_event_is_always_critical() -> None:
    engine = EventEngine({"events": {"evidence_path": "data/evidence"}})
    assert engine.calculate_severity("weapon_detected") == "critical"
