"""
IBVAP — Automated Model Weight Downloader
==========================================
Ensures all required AI models are downloaded and available locally
when cloning the repository on a new machine.

Usage:
    python scripts/download_models.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
import urllib.request
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("model_downloader")

REPO_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = REPO_ROOT / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

WEAPON_MODEL_PATH = MODELS_DIR / "weapon_detector.pt"
WEAPON_MODEL_URL = "https://huggingface.co/HaiderKhan6410/weapon-yolo26x/resolve/main/model/best.pt"


def download_file(url: str, dest_path: Path, description: str) -> bool:
    """Download a file with progress reporting."""
    if dest_path.is_file() and dest_path.stat().st_size > 10_000_000:
        logger.info("✓ %s already exists at: %s (%.1f MB)", description, dest_path, dest_path.stat().st_size / (1024 * 1024))
        return True

    logger.info("Downloading %s from %s...", description, url)
    temp_path = dest_path.with_suffix(".tmp")
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (IBVAP Surveillance Platform)"},
        )
        with urllib.request.urlopen(req) as resp, open(temp_path, "wb") as out:
            total = int(resp.headers.get("Content-Length", 0))
            downloaded = 0
            chunk_size = 1024 * 1024  # 1MB chunks
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                out.write(chunk)
                downloaded += len(chunk)
                if total > 0 and downloaded % (15 * 1024 * 1024) < chunk_size:
                    pct = (downloaded / total) * 100
                    logger.info("  %s: %.1f / %.1f MB (%.1f%%)", description, downloaded / (1024 * 1024), total / (1024 * 1024), pct)

        if temp_path.exists() and temp_path.stat().st_size > 10_000_000:
            temp_path.replace(dest_path)
            logger.info("✓ %s downloaded successfully to: %s", description, dest_path)
            return True
        else:
            if temp_path.exists():
                temp_path.unlink()
            return False
    except Exception as e:
        logger.error("✗ Failed to download %s: %s", description, e)
        if temp_path.exists():
            temp_path.unlink()
        return False


def main():
    logger.info("Checking IBVAP required model weights...")

    # 1. Weapon Detector Model
    success_weapon = download_file(WEAPON_MODEL_URL, WEAPON_MODEL_PATH, "Weapon Detector Model")

    # 2. General COCO detector check (YOLO downloads automatically if missing)
    try:
        from ultralytics import YOLO
        yolo_coco = MODELS_DIR / "yolo26n.pt"
        if not yolo_coco.is_file():
            logger.info("Downloading base YOLO detector weights...")
            m = YOLO("yolo26n.pt")
            if Path("yolo26n.pt").is_file() and not yolo_coco.is_file():
                Path("yolo26n.pt").replace(yolo_coco)
        logger.info("✓ Base YOLO detector is ready.")
    except Exception as e:
        logger.warning("Base YOLO detector check notice: %s", e)

    if success_weapon:
        logger.info("All model weights are verified and ready for IBVAP execution!")
    else:
        logger.warning("Some models could not be downloaded. Please verify your internet connection.")


if __name__ == "__main__":
    main()
