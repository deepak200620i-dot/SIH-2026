"""
IBVAP — FastAPI Application Entry Point
======================================
Assembles REST & WebSocket routes, initializes SQLite database on startup,
configures CORS middleware, serves static evidence & faces, and serves the
React dashboard SPA for unified Render deployment.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import aiosqlite
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from src.api.models import StatsResponse
from src.api.routes import cameras_router, config_router, events_router, faces_router, video_router
from src.db.crud import get_stats
from src.db.database import get_db, init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for directory and database initialization on startup."""
    # Ensure necessary data directories exist
    os.makedirs("data/evidence", exist_ok=True)
    os.makedirs("data/faces", exist_ok=True)
    os.makedirs("data/uploads", exist_ok=True)
    os.makedirs("data", exist_ok=True)

    # Initialize database schema
    await init_db()

    # Warm up AI pipeline in background thread
    import asyncio
    from src.api.routes.video import warmup_pipeline
    asyncio.get_event_loop().run_in_executor(None, warmup_pipeline)

    yield


app = FastAPI(
    title="IBVAP — Intelligent Border Video Analytics Platform API",
    description="Backend REST API and WebSocket live stream for border security analytics.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for frontend React dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(events_router)
app.include_router(cameras_router)
app.include_router(config_router)
app.include_router(faces_router)
app.include_router(video_router)

# Mount static files for evidence snapshots and face gallery images
os.makedirs("data/evidence", exist_ok=True)
os.makedirs("data/faces", exist_ok=True)
app.mount("/api/evidence", StaticFiles(directory="data/evidence"), name="evidence")
app.mount("/api/faces/images", StaticFiles(directory="data/faces"), name="face_images")


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "service": "IBVAP Backend API", "version": "1.0.0"}


@app.get("/api/stats", response_model=StatsResponse)
async def fetch_stats_fallback(
    db: aiosqlite.Connection = Depends(get_db),
) -> StatsResponse:
    """Fallback route for system-wide stats."""
    stats = await get_stats(db)
    return StatsResponse(**stats)


# SPA Static Frontend Support (Render & Production Deployment)
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
if not os.path.exists(FRONTEND_DIST):
    # Also check local dist
    FRONTEND_DIST = "dist" if os.path.exists("dist") else None

if FRONTEND_DIST and os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str, request: Request):
        # Ignore API and docs routes
        if full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json"):
            raise HTTPException(status_code=404, detail="Not found")

        # Serve static file if exact file exists in dist
        target_file = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(target_file):
            return FileResponse(target_file)

        # Fallback to SPA index.html
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)

        return JSONResponse({"status": "online", "service": "IBVAP API"})
else:
    @app.get("/")
    async def root() -> dict[str, str]:
        """Root endpoint when frontend is not pre-built."""
        return {
            "status": "online",
            "service": "IBVAP Backend API",
            "version": "1.0.0",
            "docs": "/docs",
        }

