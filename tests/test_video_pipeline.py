"""
IBVAP — Unit tests for VideoPipeline orchestrator
=================================================
Tests pipeline execution, sub-component integration, event processing, and reset behavior.

Run:
    python -m pytest tests/test_video_pipeline.py -v
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import numpy as np
import pytest

from src.pipeline.video_pipeline import PipelineFrameResult, VideoPipeline


@pytest.fixture
def mock_pipeline():
    with patch("src.pipeline.video_pipeline.Tracker") as mock_tracker, \
         patch("src.pipeline.video_pipeline.FaceRecognizer") as mock_face, \
         patch("src.pipeline.video_pipeline.PlateReader") as mock_plate:

        mock_tr_inst = MagicMock()
        mock_tr_inst.track.return_value = MagicMock(tracked_objects=[])
        mock_tracker.return_value = mock_tr_inst

        pipeline = VideoPipeline(enable_face=False, enable_anpr=False)
        return pipeline


def test_pipeline_process_frame(mock_pipeline):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    res = mock_pipeline.process_frame(frame, frame_index=1, timestamp=100.0)

    assert res is not None
    assert isinstance(res, PipelineFrameResult)
    assert res.frame_index == 1
    assert res.timestamp == 100.0
    assert res.annotated_frame is not None
    assert res.annotated_frame.shape == frame.shape


def test_pipeline_reset(mock_pipeline):
    mock_pipeline.reset()
    mock_pipeline.tracker.reset.assert_called_once()
