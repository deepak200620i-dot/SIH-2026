"""
IBVAP — Unit tests for PlateReader (ANPR)
=========================================
Tests text cleaning, plate format regex validation, mocked EasyOCR extraction, and visual overlay drawing.

Run:
    python -m pytest tests/test_plate_reader.py -v
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import numpy as np
import pytest

from src.anpr.plate_reader import PlateMatch, PlateReader


@pytest.fixture
def reader():
    return PlateReader({"anpr": {"min_confidence": 0.4, "gpu": False}})


def test_clean_text():
    assert PlateReader.clean_text(" MH 12-AB 1234 ") == "MH12AB1234"
    assert PlateReader.clean_text("dl.01.c!1234") == "DL01C1234"
    assert PlateReader.clean_text("") == ""


def test_is_valid_plate():
    # Valid Indian formats
    assert PlateReader.is_valid_plate("MH12AB1234") is True
    assert PlateReader.is_valid_plate("DL01C1234") is True
    assert PlateReader.is_valid_plate("KA05M9999") is True

    # Valid General formats
    assert PlateReader.is_valid_plate("ABC1234") is True
    assert PlateReader.is_valid_plate("CAR999") is True

    # Invalid formats
    assert PlateReader.is_valid_plate("AB") is False
    assert PlateReader.is_valid_plate("A"*15) is False
    assert PlateReader.is_valid_plate("!!!") is False


def test_read_plate_mocked(reader):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    bbox = (50, 50, 250, 200)

    mock_ocr = MagicMock()
    mock_ocr.readtext.return_value = [
        ([ [10, 10], [90, 10], [90, 40], [10, 40] ], "MH12AB1234", 0.95)
    ]
    reader._reader = mock_ocr

    match = reader.read_plate(frame, vehicle_bbox=bbox, track_id=10, class_name="car")
    assert match is not None
    assert isinstance(match, PlateMatch)
    assert match.plate_text == "MH12AB1234"
    assert match.confidence == 0.95
    assert match.vehicle_track_id == 10


def test_draw_plate_matches(reader):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    match = PlateMatch(
        plate_text="MH12AB1234",
        confidence=0.9,
        vehicle_track_id=1,
        vehicle_bbox=(50, 50, 250, 200),
        plate_bbox=(60, 60, 200, 100),
    )
    annotated = PlateReader.draw_plate_matches(frame, [match])
    assert annotated is not None
    assert annotated.shape == frame.shape
