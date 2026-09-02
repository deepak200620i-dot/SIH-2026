"""
IBVAP — System & Fence Configuration Routes
===========================================
GET and POST endpoints for virtual fence and system settings.
"""

from __future__ import annotations

import os
from typing import Any

import yaml
from fastapi import APIRouter, HTTPException

from src.api.models import ConfigResponse, FenceConfigUpdate, FenceZoneSchema

router = APIRouter(prefix="/api/config", tags=["config"])
CONFIG_PATH = "config/settings.yaml"


def _read_config() -> dict[str, Any]:
    if not os.path.exists(CONFIG_PATH):
        return {}
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _write_config(cfg: dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(cfg, f, default_flow_style=False, sort_keys=False)


@router.get("/fence", response_model=dict[str, Any])
async def get_fence_config() -> dict[str, Any]:
    """Retrieve current virtual fence configuration."""
    cfg = _read_config()
    return cfg.get("fence", {"cooldown_seconds": 30.0, "zones": []})


@router.post("/fence", response_model=ConfigResponse)
async def update_fence_config(payload: FenceConfigUpdate) -> ConfigResponse:
    """Update virtual fence configuration zones and cooldown."""
    cfg = _read_config()

    fence_dict = {
        "cooldown_seconds": payload.cooldown_seconds,
        "zones": [z.model_dump() for z in payload.zones],
    }
    cfg["fence"] = fence_dict

    try:
        _write_config(cfg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update config: {str(e)}")

    return ConfigResponse(
        status="success",
        message="Fence configuration updated successfully",
        config=fence_dict,
    )
