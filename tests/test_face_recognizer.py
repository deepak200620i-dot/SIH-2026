"""
IBVAP — Face Recognition Tests (Step 3)
=========================================
Unit tests for FaceRecognizer, FaceMatch, and GalleryEntry.

Uses mocks to avoid InsightFace model downloads — all tests run fast
without GPU or network access.
"""

from __future__ import annotations

import numpy as np
import pytest
from unittest.mock import MagicMock, patch

from src.face.recognizer import FaceMatch, GalleryEntry, FaceRecognizer


# ── Helpers ─────────────────────────────────────────────────────────────────

def _make_mock_face(
    bbox: list[float],
    det_score: float,
    embedding: np.ndarray,
) -> MagicMock:
    """Create a mock InsightFace Face object."""
    face = MagicMock()
    face.bbox = np.array(bbox, dtype=np.float32)
    face.det_score = det_score
    face.embedding = embedding
    norm = np.linalg.norm(embedding)
    face.normed_embedding = embedding / norm if norm > 1e-10 else embedding
    return face


def _make_mock_app(faces_to_return: list | None = None) -> MagicMock:
    """Create a mock FaceAnalysis app."""
    app = MagicMock()
    app.get = MagicMock(return_value=faces_to_return or [])
    app.prepare = MagicMock()
    return app


def _build_recognizer(mock_app: MagicMock | None = None, **config_overrides):
    """Build a FaceRecognizer with mocked model + gallery loading."""
    app = mock_app or _make_mock_app()
    with patch.object(FaceRecognizer, "_load_model", return_value=app), \
         patch.object(FaceRecognizer, "_load_gallery", return_value=None):
        cfg = {
            "gallery_path": "data/faces",
            "similarity_threshold": 0.6,
            "min_face_size": 20,
        }
        cfg.update(config_overrides)
        return FaceRecognizer(cfg)


# ═══════════════════════════════════════════════════════════════════════════
#  FaceMatch dataclass
# ═══════════════════════════════════════════════════════════════════════════

class TestFaceMatch:

    def test_creation(self):
        m = FaceMatch(
            face_bbox=(10, 20, 50, 60),
            person_bbox=(0, 0, 100, 200),
            person_track_id=5,
            name="john",
            confidence=0.85,
            is_known=True,
            det_score=0.99,
        )
        assert m.name == "john"
        assert m.is_known is True
        assert m.confidence == 0.85
        assert m.det_score == 0.99
        assert m.person_track_id == 5

    def test_face_center(self):
        m = FaceMatch(
            face_bbox=(10, 20, 50, 60),
            person_bbox=(0, 0, 100, 200),
            person_track_id=-1,
            name="unknown",
            confidence=0.0,
            is_known=False,
        )
        assert m.face_center == (30, 40)

    def test_unknown_face(self):
        m = FaceMatch(
            face_bbox=(10, 20, 50, 60),
            person_bbox=(0, 0, 100, 200),
            person_track_id=3,
            name="unknown",
            confidence=0.3,
            is_known=False,
        )
        assert not m.is_known
        assert m.name == "unknown"

    def test_embedding_stored(self):
        emb = np.random.randn(512).astype(np.float32)
        m = FaceMatch(
            face_bbox=(0, 0, 10, 10),
            person_bbox=(0, 0, 100, 200),
            person_track_id=-1,
            name="test",
            confidence=0.9,
            is_known=True,
            embedding=emb,
        )
        assert m.embedding is not None
        assert m.embedding.shape == (512,)

    def test_default_embedding_is_none(self):
        m = FaceMatch(
            face_bbox=(0, 0, 10, 10),
            person_bbox=(0, 0, 100, 200),
            person_track_id=-1,
            name="test",
            confidence=0.9,
            is_known=True,
        )
        assert m.embedding is None

    def test_default_det_score_is_zero(self):
        m = FaceMatch(
            face_bbox=(0, 0, 10, 10),
            person_bbox=(0, 0, 100, 200),
            person_track_id=-1,
            name="test",
            confidence=0.9,
            is_known=True,
        )
        assert m.det_score == 0.0


# ═══════════════════════════════════════════════════════════════════════════
#  GalleryEntry
# ═══════════════════════════════════════════════════════════════════════════

class TestGalleryEntry:

    def test_creation_empty(self):
        entry = GalleryEntry(name="alice")
        assert entry.name == "alice"
        assert entry.mean_embedding is None
        assert entry.image_count == 0

    def test_mean_embedding(self):
        e1 = np.array([1.0, 0.0, 0.0])
        e2 = np.array([0.0, 1.0, 0.0])
        entry = GalleryEntry(name="bob", embeddings=[e1, e2], image_count=2)
        mean = entry.mean_embedding
        assert mean is not None
        assert np.isclose(np.linalg.norm(mean), 1.0)  # Must be L2-normalised

    def test_single_embedding_mean(self):
        e = np.array([0.0, 0.0, 1.0])
        entry = GalleryEntry(name="charlie", embeddings=[e], image_count=1)
        np.testing.assert_array_almost_equal(entry.mean_embedding, e)


# ═══════════════════════════════════════════════════════════════════════════
#  FaceRecognizer — Matching logic
# ═══════════════════════════════════════════════════════════════════════════

class TestMatchEmbedding:

    def setup_method(self):
        self.rec = _build_recognizer()

    def test_identical_embedding_scores_near_one(self):
        emb = np.random.randn(512).astype(np.float32)
        emb /= np.linalg.norm(emb)
        self.rec.add_face_embedding("alice", emb)

        name, score = self.rec._match_embedding(emb)
        assert name == "alice"
        assert score > 0.99

    def test_similar_embedding_matches(self):
        rng = np.random.RandomState(42)  # Deterministic
        emb = rng.randn(512).astype(np.float32)
        emb /= np.linalg.norm(emb)
        self.rec.add_face_embedding("bob", emb)

        noisy = emb + rng.randn(512).astype(np.float32) * 0.05
        noisy /= np.linalg.norm(noisy)

        name, score = self.rec._match_embedding(noisy)
        assert name == "bob"
        assert score > 0.6

    def test_orthogonal_embedding_is_unknown(self):
        emb1 = np.zeros(512, dtype=np.float32); emb1[0] = 1.0
        self.rec.add_face_embedding("charlie", emb1)

        emb2 = np.zeros(512, dtype=np.float32); emb2[255] = 1.0
        name, _ = self.rec._match_embedding(emb2)
        assert name == "unknown"

    def test_empty_gallery_returns_unknown(self):
        emb = np.random.randn(512).astype(np.float32)
        emb /= np.linalg.norm(emb)
        name, score = self.rec._match_embedding(emb)
        assert name == "unknown"
        assert score == 0.0

    def test_best_match_among_multiple_persons(self):
        emb_a = np.zeros(512, dtype=np.float32); emb_a[0] = 1.0
        emb_b = np.zeros(512, dtype=np.float32); emb_b[1] = 1.0
        self.rec.add_face_embedding("alice", emb_a)
        self.rec.add_face_embedding("bob", emb_b)

        query = np.zeros(512, dtype=np.float32)
        query[0] = 0.95; query[1] = 0.05
        query /= np.linalg.norm(query)

        name, _ = self.rec._match_embedding(query)
        assert name == "alice"

    def test_below_threshold_returns_unknown_with_score(self):
        """Score is still returned even if below threshold (for diagnostics)."""
        emb_a = np.zeros(512, dtype=np.float32); emb_a[0] = 1.0
        self.rec.add_face_embedding("alice", emb_a)

        # Partially similar — dot product will be positive but low
        query = np.zeros(512, dtype=np.float32)
        query[0] = 0.3; query[1] = 0.95
        query /= np.linalg.norm(query)

        name, score = self.rec._match_embedding(query)
        assert name == "unknown"
        assert score > 0  # Score is still reported


# ═══════════════════════════════════════════════════════════════════════════
#  FaceRecognizer — Gallery management
# ═══════════════════════════════════════════════════════════════════════════

class TestGalleryManagement:

    def setup_method(self):
        self.rec = _build_recognizer()

    def test_gallery_size_starts_empty(self):
        assert self.rec.gallery_size == 0

    def test_add_increments_size(self):
        emb = np.random.randn(512).astype(np.float32)
        self.rec.add_face_embedding("p1", emb)
        assert self.rec.gallery_size == 1
        self.rec.add_face_embedding("p2", emb)
        assert self.rec.gallery_size == 2

    def test_gallery_names_sorted(self):
        emb = np.random.randn(512).astype(np.float32)
        self.rec.add_face_embedding("bob", emb)
        self.rec.add_face_embedding("alice", emb)
        assert self.rec.gallery_names == ["alice", "bob"]

    def test_add_multiple_embeddings_same_person(self):
        self.rec.add_face_embedding("dave", np.random.randn(512).astype(np.float32))
        self.rec.add_face_embedding("dave", np.random.randn(512).astype(np.float32))
        assert self.rec.gallery_size == 1
        assert len(self.rec._gallery["dave"].embeddings) == 2

    def test_added_embeddings_are_normalised(self):
        emb = np.random.randn(512).astype(np.float32) * 5  # Unnormalised
        self.rec.add_face_embedding("norm_test", emb)
        stored = self.rec._gallery["norm_test"].embeddings[0]
        assert np.isclose(np.linalg.norm(stored), 1.0, atol=1e-5)


# ═══════════════════════════════════════════════════════════════════════════
#  FaceRecognizer — recognize() method
# ═══════════════════════════════════════════════════════════════════════════

class TestRecognize:

    def setup_method(self):
        self.mock_app = _make_mock_app()
        self.rec = _build_recognizer(self.mock_app)

    def test_known_face_detected(self):
        emb = np.random.randn(512).astype(np.float32)
        emb /= np.linalg.norm(emb)
        self.rec.add_face_embedding("alice", emb)

        self.mock_app.get.return_value = [
            _make_mock_face([10, 10, 50, 50], 0.95, emb),
        ]
        frame = np.zeros((200, 200, 3), dtype=np.uint8)
        match = self.rec.recognize(frame, (0, 0, 100, 200), person_track_id=1)

        assert match is not None
        assert match.is_known is True
        assert match.name == "alice"
        assert match.person_track_id == 1

    def test_no_face_returns_none(self):
        self.mock_app.get.return_value = []
        frame = np.zeros((200, 200, 3), dtype=np.uint8)
        assert self.rec.recognize(frame, (0, 0, 100, 200)) is None

    def test_small_crop_returns_none(self):
        frame = np.zeros((200, 200, 3), dtype=np.uint8)
        assert self.rec.recognize(frame, (0, 0, 10, 10)) is None

    def test_unknown_face(self):
        gal = np.zeros(512, dtype=np.float32); gal[0] = 1.0
        self.rec.add_face_embedding("alice", gal)

        query = np.zeros(512, dtype=np.float32); query[255] = 1.0
        self.mock_app.get.return_value = [
            _make_mock_face([10, 10, 50, 50], 0.9, query),
        ]
        frame = np.zeros((200, 200, 3), dtype=np.uint8)
        match = self.rec.recognize(frame, (0, 0, 100, 200))

        assert match is not None
        assert match.is_known is False
        assert match.name == "unknown"

    def test_face_bbox_converted_to_frame_coords(self):
        emb = np.random.randn(512).astype(np.float32)
        emb /= np.linalg.norm(emb)
        self.mock_app.get.return_value = [
            _make_mock_face([10, 10, 50, 50], 0.95, emb),
        ]
        frame = np.zeros((300, 300, 3), dtype=np.uint8)
        match = self.rec.recognize(frame, (20, 30, 200, 250))

        assert match is not None
        # (10+20, 10+30, 50+20, 50+30)
        assert match.face_bbox == (30, 40, 70, 80)

    def test_person_bbox_clamped_to_frame(self):
        emb = np.random.randn(512).astype(np.float32)
        emb /= np.linalg.norm(emb)
        self.mock_app.get.return_value = [
            _make_mock_face([5, 5, 45, 45], 0.95, emb),
        ]
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        match = self.rec.recognize(frame, (-10, -10, 150, 150))

        assert match is not None
        assert match.person_bbox == (0, 0, 100, 100)

    def test_embedding_stored_in_result(self):
        emb = np.random.randn(512).astype(np.float32)
        emb /= np.linalg.norm(emb)
        self.mock_app.get.return_value = [
            _make_mock_face([10, 10, 50, 50], 0.95, emb),
        ]
        frame = np.zeros((200, 200, 3), dtype=np.uint8)
        match = self.rec.recognize(frame, (0, 0, 100, 200))

        assert match is not None
        assert match.embedding is not None
        assert match.embedding.shape == (512,)


# ═══════════════════════════════════════════════════════════════════════════
#  FaceRecognizer — recognize_frame() method
# ═══════════════════════════════════════════════════════════════════════════

class TestRecognizeFrame:

    def setup_method(self):
        self.mock_app = _make_mock_app()
        self.rec = _build_recognizer(self.mock_app)

    def _mock_obj(self, class_name: str, bbox, track_id: int):
        obj = MagicMock()
        obj.class_name = class_name
        obj.bbox_xyxy = bbox
        obj.track_id = track_id
        return obj

    def test_only_processes_persons(self):
        emb = np.random.randn(512).astype(np.float32)
        emb /= np.linalg.norm(emb)
        self.mock_app.get.return_value = [
            _make_mock_face([10, 10, 50, 50], 0.95, emb),
        ]

        objects = [
            self._mock_obj("person", (0, 0, 100, 200), 1),
            self._mock_obj("car", (50, 50, 150, 150), 2),
        ]
        frame = np.zeros((300, 300, 3), dtype=np.uint8)
        matches = self.rec.recognize_frame(frame, objects)

        assert len(matches) == 1
        assert matches[0].person_track_id == 1

    def test_multiple_persons(self):
        emb = np.random.randn(512).astype(np.float32)
        emb /= np.linalg.norm(emb)
        self.mock_app.get.return_value = [
            _make_mock_face([10, 10, 50, 50], 0.95, emb),
        ]

        objects = [
            self._mock_obj("person", (0, 0, 100, 200), 1),
            self._mock_obj("person", (150, 0, 250, 200), 2),
        ]
        frame = np.zeros((300, 300, 3), dtype=np.uint8)
        matches = self.rec.recognize_frame(frame, objects)

        assert len(matches) == 2

    def test_empty_list(self):
        frame = np.zeros((300, 300, 3), dtype=np.uint8)
        assert self.rec.recognize_frame(frame, []) == []

    def test_no_person_in_list(self):
        objects = [
            self._mock_obj("car", (0, 0, 100, 100), 1),
            self._mock_obj("truck", (50, 50, 200, 200), 2),
        ]
        frame = np.zeros((300, 300, 3), dtype=np.uint8)
        assert self.rec.recognize_frame(frame, objects) == []


# ═══════════════════════════════════════════════════════════════════════════
#  FaceRecognizer — _normalize()
# ═══════════════════════════════════════════════════════════════════════════

class TestNormalize:

    def test_normalises_vector(self):
        v = np.array([3.0, 4.0])
        result = FaceRecognizer._normalize(v)
        assert np.isclose(np.linalg.norm(result), 1.0)

    def test_zero_vector_unchanged(self):
        v = np.zeros(512)
        result = FaceRecognizer._normalize(v)
        assert result.shape == (512,)

    def test_already_normalised(self):
        v = np.array([1.0, 0.0, 0.0])
        result = FaceRecognizer._normalize(v)
        np.testing.assert_array_almost_equal(result, v)


# ═══════════════════════════════════════════════════════════════════════════
#  FaceRecognizer — draw_face_matches()
# ═══════════════════════════════════════════════════════════════════════════

class TestDrawFaceMatches:

    def _make_match(self, is_known: bool):
        return FaceMatch(
            face_bbox=(10, 20, 50, 60),
            person_bbox=(0, 0, 100, 200),
            person_track_id=1 if is_known else -1,
            name="alice" if is_known else "unknown",
            confidence=0.85 if is_known else 0.0,
            is_known=is_known,
            det_score=0.95,
        )

    def test_draw_known(self):
        frame = np.zeros((200, 200, 3), dtype=np.uint8)
        result = FaceRecognizer.draw_face_matches(frame, [self._make_match(True)])
        assert result.shape == frame.shape
        assert not np.array_equal(result, frame)

    def test_draw_unknown(self):
        frame = np.zeros((200, 200, 3), dtype=np.uint8)
        result = FaceRecognizer.draw_face_matches(frame, [self._make_match(False)])
        assert result.shape == frame.shape
        assert not np.array_equal(result, frame)

    def test_draw_empty_list(self):
        frame = np.zeros((200, 200, 3), dtype=np.uint8)
        result = FaceRecognizer.draw_face_matches(frame, [])
        np.testing.assert_array_equal(result, frame)

    def test_returns_copy(self):
        frame = np.zeros((200, 200, 3), dtype=np.uint8)
        result = FaceRecognizer.draw_face_matches(frame, [self._make_match(True)])
        assert result is not frame
