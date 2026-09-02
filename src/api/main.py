"""
IBVAP — FastAPI Application Entry Point
======================================
Assembles REST & WebSocket routes, initializes SQLite database on startup,
configures CORS middleware, and serves static evidence snapshots.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.api.routes import cameras_router, config_router, events_router
from src.db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for database initialization on startup."""
    # Ensure directories exist
    os.makedirs("data/evidence", exist_ok=True)
    os.makedirs("data", exist_ok=True)

    # Initialize SQLite database schema
    await init_db()
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

# Mount static files for evidence snapshots
if not os.path.exists("data/evidence"):
    os.makedirs("data/evidence", exist_ok=True)
app.mount("/api/evidence", StaticFiles(directory="data/evidence"), name="evidence")


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint for API health check."""
    return {
        "status": "online",
        "service": "IBVAP Backend API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
