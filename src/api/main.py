"""
IBVAP — FastAPI Application Entry Point
======================================
Assembles REST & WebSocket routes, initializes PostgreSQL database on startup,
configures CORS middleware, and serves the React dashboard SPA for deployment.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv

# Load .env before any module reads os.getenv
load_dotenv()

# Limit BLAS / OpenMP threads to prevent memory allocation exhaustion on Windows CPU
os.environ.setdefault("OPENBLAS_NUM_THREADS", "2")
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from src.api.models import StatsResponse
from src.api.routes import (
    cameras_router,
    config_router,
    events_router,
    faces_router,
    video_router,
    zones_router,
)
from src.api.routes.auth import router as auth_router
from src.api.routes.security import router as security_router
from src.api.routes.evidence import router as evidence_router
from src.db.crud import get_event_stats
from src.db.database import close_db, get_db, init_db, seed_admin_user


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for directory and database initialization on startup."""
    # Ensure necessary data directories exist
    os.makedirs("data/evidence", exist_ok=True)
    os.makedirs("data/faces", exist_ok=True)
    os.makedirs("data/uploads", exist_ok=True)
    os.makedirs("data/ledger", exist_ok=True)
    os.makedirs("data", exist_ok=True)

    # Initialize PostgreSQL database schema
    await init_db()

    # Seed admin user
    await seed_admin_user()

    # ── Security startup checks ──────────────────────────────────────
    _jwt = os.getenv("JWT_SECRET", "")
    _admin_pw = os.getenv("IBVAP_ADMIN_PASSWORD", "")
    if not _jwt or _jwt == "ibvap-sih-2026-jwt-secret-key-CHANGE-IN-PROD":
        print(
            "\n⚠️  WARNING: JWT_SECRET is set to the default value. "
            "Anyone can forge authentication tokens. "
            "Set a unique, random JWT_SECRET in production!\n"
        )
    if not _admin_pw or _admin_pw == "Admin@123":
        print(
            "⚠️  WARNING: IBVAP_ADMIN_PASSWORD is the default 'Admin@123'. "
            "Change it immediately for production deployments.\n"
        )

    # Load any saved fence zones into pipeline
    try:
        from src.api.routes.video import get_pipeline
        from src.db.crud import get_fence_zones
        from src.db.database import get_db_pool

        pool = get_db_pool()
        async with pool.acquire() as conn:
            zones = await get_fence_zones(conn)
            if zones:
                get_pipeline().update_zones(zones)
    except Exception as e:
        print(f"Initial zones load notice: {e}")

    # Warm up AI pipeline in background thread
    import asyncio
    from src.api.routes.video import warmup_pipeline
    asyncio.get_event_loop().run_in_executor(None, warmup_pipeline)

    yield

    # Shutdown: close database pool
    await close_db()


app = FastAPI(
    title="IBVAP — Intelligent Border Video Analytics Platform API",
    description="Backend REST API and WebSocket live stream for border security analytics.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS middleware — configurable origins from environment
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
cors_origins = [o.strip() for o in cors_origins_str.split(",") if o.strip()]
# In development, also allow wildcard if no origins configured
if not cors_origins:
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth_router)
app.include_router(security_router)
app.include_router(evidence_router)
app.include_router(events_router)
app.include_router(cameras_router)
app.include_router(config_router)
app.include_router(faces_router)
app.include_router(video_router)
app.include_router(zones_router)

# Static files for face gallery images (evidence is now served via authenticated endpoint)
os.makedirs("data/evidence", exist_ok=True)
os.makedirs("data/faces", exist_ok=True)
app.mount("/api/faces/images", StaticFiles(directory="data/faces"), name="face_images")


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "service": "IBVAP Backend API", "version": "2.0.0"}


@app.get("/api/stats")
async def fetch_stats_fallback(
    db=Depends(get_db),
) -> dict:
    """Fallback route for system-wide stats."""
    stats = await get_event_stats(db)
    return stats


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
            "version": "2.0.0",
            "docs": "/docs",
        }
