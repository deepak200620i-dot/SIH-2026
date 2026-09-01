"""
IBVAP — Face Detection + Recognition
======================================
Detects faces in person crops and matches against a known-face gallery
using InsightFace (ArcFace) embeddings with cosine similarity.

Pipeline:
    1. On startup: Load InsightFace model + scan gallery folder for known faces
    2. Per frame:  For each person crop → detect faces → match against gallery

Usage:
    from src.face.recognizer import FaceRecognizer
    recognizer = FaceRecognizer(config)
    matches = recognizer.recognize_frame(frame, tracked_objects)
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)


# ── Structured face match result ────────────────────────────────────────────

@dataclass
class FaceMatch:
    """Result of face recognition for a single detected face."""

    face_bbox: tuple[int, int, int, int]       # Face bbox in original frame coords (x1,y1,x2,y2)
    person_bbox: tuple[int, int, int, int]      # Person bbox from YOLO (x1,y1,x2,y2)
    person_track_id: int                         # ByteTrack ID (-1 if untracked)
    name: str                                    # Matched person name or "unknown"
    confidence: float                            # Cosine similarity score (0‑1), 0 if unknown
    is_known: bool                               # True if matched above threshold
    det_score: float = 0.0                       # Face detection confidence
    embedding: np.ndarray | None = field(        # 512-d ArcFace embedding (optional)
        default=None, repr=False,
    )

    @property
    def face_center(self) -> tuple[int, int]:
        """Centre point of the face bounding box."""
        x1, y1, x2, y2 = self.face_bbox
        return ((x1 + x2) // 2, (y1 + y2) // 2)


# ── Gallery entry ───────────────────────────────────────────────────────────

@dataclass
class GalleryEntry:
    """A known person in the face gallery with one or more reference embeddings."""

    name: str
    embeddings: list[np.ndarray] = field(default_factory=list, repr=False)
    image_count: int = 0

    @property
    def mean_embedding(self) -> np.ndarray | None:
        """L2-normalised mean of all stored embeddings (useful for fast search)."""
        if not self.embeddings:
            return None
        mean = np.mean(self.embeddings, axis=0)
        norm = np.linalg.norm(mean)
        if norm < 1e-10:
            return mean
        return mean / norm


# ── Face Recognizer class ───────────────────────────────────────────────────

class FaceRecognizer:
    """
    Face detection and recognition using InsightFace (ArcFace).

    Parameters
    ----------
    config : dict
        The ``face`` section of settings.yaml::

            {
                "gallery_path": "data/faces",
                "similarity_threshold": 0.6,
                "model_name": "buffalo_l",
                "det_size": [640, 640],
                "gpu_id": -1,
                "min_face_size": 20,
            }
    """

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.gallery_path = Path(config.get("gallery_path", "data/faces"))
        self.similarity_threshold = config.get("similarity_threshold", 0.6)
        self.model_name = config.get("model_name", "buffalo_l")
        self.det_size = tuple(config.get("det_size", [640, 640]))
        self.gpu_id = config.get("gpu_id", -1)
        self.min_face_size = config.get("min_face_size", 20)

        # Gallery storage: name → GalleryEntry
        self._gallery: dict[str, GalleryEntry] = {}

        # Load InsightFace model
        self._app = self._load_model()

        # Load known-face gallery from disk
        self._load_gallery()

        logger.info(
            "FaceRecognizer initialised: model=%s, gallery=%d persons, "
            "threshold=%.2f",
            self.model_name, len(self._gallery), self.similarity_threshold,
        )

    # ── Private helpers ──────────────────────────────────────────────────

    def _load_model(self):
        """Load InsightFace FaceAnalysis model pack."""
        from insightface.app import FaceAnalysis

        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if self.gpu_id >= 0
            else ["CPUExecutionProvider"]
        )

        app = FaceAnalysis(name=self.model_name, providers=providers)
        app.prepare(ctx_id=self.gpu_id, det_size=self.det_size)

        logger.info("InsightFace model '%s' loaded (providers=%s)",
                     self.model_name, providers)
        return app

    @staticmethod
    def _normalize(embedding: np.ndarray) -> np.ndarray:
        """L2-normalise an embedding vector."""
        norm = np.linalg.norm(embedding)
        if norm < 1e-10:
            return embedding
        return embedding / norm

    def _extract_embedding(self, face) -> np.ndarray:
        """Extract normalised embedding from an InsightFace Face object."""
        if hasattr(face, "normed_embedding") and face.normed_embedding is not None:
            return face.normed_embedding
        return self._normalize(face.embedding)

    def _load_gallery(self) -> None:
        """Scan the gallery directory and build embedding vectors for all persons."""
        if not self.gallery_path.exists():
            logger.warning("Gallery path does not exist: %s", self.gallery_path)
            return

        valid_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

        for person_dir in sorted(self.gallery_path.iterdir()):
            if not person_dir.is_dir() or person_dir.name.startswith("."):
                continue

            name = person_dir.name
            embeddings: list[np.ndarray] = []
            image_count = 0

            for img_path in sorted(person_dir.iterdir()):
                if img_path.suffix.lower() not in valid_extensions:
                    continue

                img = cv2.imread(str(img_path))
                if img is None:
                    logger.warning("Could not read image: %s", img_path)
                    continue

                image_count += 1
                faces = self._app.get(img)

                if not faces:
                    logger.warning("No face found in: %s", img_path)
                    continue

                # Take the largest face (most prominent in the reference image)
                face = max(
                    faces,
                    key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
                )
                embeddings.append(self._extract_embedding(face))

            if embeddings:
                self._gallery[name] = GalleryEntry(
                    name=name,
                    embeddings=embeddings,
                    image_count=image_count,
                )
                logger.info(
                    "Gallery: '%s' — %d embeddings from %d images",
                    name, len(embeddings), image_count,
                )
            else:
                logger.warning("Gallery: '%s' — no valid face embeddings extracted", name)

    def _match_embedding(self, embedding: np.ndarray) -> tuple[str, float]:
        """
        Match a face embedding against the gallery.

        Returns
        -------
        (name, similarity_score)
            ``("unknown", 0.0)`` if the gallery is empty or no match is found
            above the similarity threshold.
        """
        if not self._gallery:
            return ("unknown", 0.0)

        best_name = "unknown"
        best_score = 0.0

        for name, entry in self._gallery.items():
            for gallery_emb in entry.embeddings:
                # Cosine similarity = dot product of L2-normalised vectors
                score = float(np.dot(embedding, gallery_emb))
                if score > best_score:
                    best_score = score
                    best_name = name

        if best_score < self.similarity_threshold:
            return ("unknown", best_score)

        return (best_name, best_score)

    # ── Public API ───────────────────────────────────────────────────────

    @property
    def gallery_size(self) -> int:
        """Number of known persons in the gallery."""
        return len(self._gallery)

    @property
    def gallery_names(self) -> list[str]:
        """Sorted list of known person names."""
        return sorted(self._gallery.keys())

    def add_face_embedding(self, name: str, embedding: np.ndarray) -> None:
        """
        Add a face embedding to the gallery programmatically.

        The embedding is L2-normalised before storage.
        """
        normed = self._normalize(embedding)
        if name in self._gallery:
            self._gallery[name].embeddings.append(normed)
            self._gallery[name].image_count += 1
        else:
            self._gallery[name] = GalleryEntry(
                name=name, embeddings=[normed], image_count=1,
            )

    def recognize(
        self,
        frame: np.ndarray,
        person_bbox: tuple[int, int, int, int],
        person_track_id: int = -1,
    ) -> FaceMatch | None:
        """
        Detect and recognise a face within a person bounding box.

        Parameters
        ----------
        frame : np.ndarray
            Full BGR frame.
        person_bbox : tuple
            Person bounding box ``(x1, y1, x2, y2)`` from YOLO.
        person_track_id : int
            ByteTrack ID for this person (``-1`` if not tracked).

        Returns
        -------
        FaceMatch or None
            Match result, or ``None`` if no face is detected in the crop.
        """
        x1, y1, x2, y2 = person_bbox
        h, w = frame.shape[:2]

        # Clamp to frame boundaries
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        crop_w, crop_h = x2 - x1, y2 - y1
        if crop_w < self.min_face_size or crop_h < self.min_face_size:
            return None

        # Crop person region
        crop = frame[y1:y2, x1:x2]

        # Detect faces in the crop
        faces = self._app.get(crop)

        if not faces:
            return None

        # Take the face with the highest detection score
        face = max(faces, key=lambda f: f.det_score)

        # Extract embedding and match against gallery
        embedding = self._extract_embedding(face)
        matched_name, similarity = self._match_embedding(embedding)
        is_known = matched_name != "unknown"

        # Convert face bbox from crop coordinates to frame coordinates
        fx1, fy1, fx2, fy2 = face.bbox.astype(int).tolist()
        face_bbox_frame = (
            max(0, fx1 + x1),
            max(0, fy1 + y1),
            min(w, fx2 + x1),
            min(h, fy2 + y1),
        )

        return FaceMatch(
            face_bbox=face_bbox_frame,
            person_bbox=(x1, y1, x2, y2),
            person_track_id=person_track_id,
            name=matched_name,
            confidence=round(similarity, 4),
            is_known=is_known,
            det_score=round(float(face.det_score), 4),
            embedding=embedding,
        )

    def recognize_frame(
        self,
        frame: np.ndarray,
        tracked_objects: list,
    ) -> list[FaceMatch]:
        """
        Run face recognition on all persons detected in a frame.

        Parameters
        ----------
        frame : np.ndarray
            Full BGR frame.
        tracked_objects : list
            List of TrackedObject (or any object with ``class_name``,
            ``bbox_xyxy``, and ``track_id`` attributes).

        Returns
        -------
        list[FaceMatch]
            One ``FaceMatch`` per detected face. May be fewer than persons
            if some crops contain no detectable face.
        """
        matches: list[FaceMatch] = []

        for obj in tracked_objects:
            if obj.class_name != "person":
                continue

            match = self.recognize(
                frame=frame,
                person_bbox=obj.bbox_xyxy,
                person_track_id=getattr(obj, "track_id", -1),
            )

            if match is not None:
                matches.append(match)

        return matches

    # ── Drawing utility ──────────────────────────────────────────────────

    @staticmethod
    def draw_face_matches(
        frame: np.ndarray,
        matches: list[FaceMatch],
    ) -> np.ndarray:
        """
        Draw face bounding boxes and recognition labels on a frame (returns a copy).

        - **Known** faces → green box + person name + similarity score
        - **Unknown** faces → red box + "UNKNOWN" + detection score
        """
        annotated = frame.copy()

        for match in matches:
            fx1, fy1, fx2, fy2 = match.face_bbox

            if match.is_known:
                color = (0, 200, 0)   # Green for known
                label = f"{match.name} ({match.confidence:.2f})"
            else:
                color = (0, 0, 255)   # Red for unknown
                label = f"UNKNOWN ({match.det_score:.2f})"

            # Face bounding box
            cv2.rectangle(annotated, (fx1, fy1), (fx2, fy2), color, 2)

            # Label background
            (tw, th), _ = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1,
            )
            cv2.rectangle(
                annotated, (fx1, fy1 - th - 8), (fx1 + tw + 4, fy1), color, -1,
            )

            # Label text (white on coloured background)
            cv2.putText(
                annotated, label, (fx1 + 2, fy1 - 4),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA,
            )

        return annotated
