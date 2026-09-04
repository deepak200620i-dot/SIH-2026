from src.api.routes.cameras import router as cameras_router
from src.api.routes.config import router as config_router
from src.api.routes.events import router as events_router
from src.api.routes.faces import router as faces_router

__all__ = [
    "events_router",
    "cameras_router",
    "config_router",
    "faces_router",
]

