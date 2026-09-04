"""
IBVAP — Face Recognition Management Routes
==========================================
GET, POST, and DELETE endpoints for managing known faces in the gallery.
"""

from __future__ import annotations

import os
import shutil
import uuid
from typing import Any

import aiosqlite
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from src.api.models import KnownFaceResponse
from src.db.crud import add_known_face, delete_known_face, get_known_faces
from src.db.database import get_db

router = APIRouter(prefix="/api/faces", tags=["faces"])
FACES_DIR = "data/faces"


@router.get("", response_model=list[KnownFaceResponse])
async def list_faces(
    db: aiosqlite.Connection = Depends(get_db),
) -> list[KnownFaceResponse]:
    """Retrieve all known face records in the gallery."""
    os.makedirs(FACES_DIR, exist_ok=True)
    faces = await get_known_faces(db)
    return [KnownFaceResponse(**f) for f in faces]


@router.post("", response_model=KnownFaceResponse, status_code=201)
async def upload_face(
    name: str = Form(...),
    image: UploadFile = File(...),
    db: aiosqlite.Connection = Depends(get_db),
) -> KnownFaceResponse:
    """Upload and register a new known face into the gallery."""
    clean_name = name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Face name cannot be empty")

    person_dir = os.path.join(FACES_DIR, clean_name.replace(" ", "_"))
    os.makedirs(person_dir, exist_ok=True)

    # Generate unique filename preserving extension
    ext = os.path.splitext(image.filename or "face.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(person_dir, filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save image: {str(e)}")

    # Add to database
    face_record = await add_known_face(
        db,
        name=clean_name,
        image_path=file_path,
    )

    return KnownFaceResponse(**face_record)


@router.delete("/{face_id}", response_model=dict[str, Any])
async def remove_face(
    face_id: int,
    db: aiosqlite.Connection = Depends(get_db),
) -> dict[str, Any]:
    """Delete a known face by ID."""
    success = await delete_known_face(db, face_id)
    if not success:
        raise HTTPException(status_code=404, detail="Face record not found")
    return {"status": "success", "message": f"Face {face_id} deleted"}
