"""FastAPI-Einstiegspunkt.

Serviert die API unter /api/* und das statische React-Build (SPA) unter /.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .database import init_db
from .routers import auth_routes, projects, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Projektzeit-Erfassung für Google Calendar", lifespan=lifespan)


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(auth_routes.router)
app.include_router(projects.router)
app.include_router(reports.router)


# --------------------------------------------------------------------------- #
# Statisches React-Build ausliefern (SPA-Fallback auf index.html).
# Pfad: backend/app/main.py -> ../../frontend/dist
# --------------------------------------------------------------------------- #
_FRONTEND_DIST = os.environ.get(
    "FRONTEND_DIST",
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"),
)
_INDEX = os.path.join(_FRONTEND_DIST, "index.html")

if os.path.isdir(_FRONTEND_DIST):
    # Assets (JS/CSS) direkt mounten.
    assets_dir = os.path.join(_FRONTEND_DIST, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    def index():
        return FileResponse(_INDEX)

    @app.exception_handler(StarletteHTTPException)
    async def spa_fallback(request, exc):
        # API-404 als JSON belassen, sonst SPA-index ausliefern.
        if exc.status_code == 404 and not request.url.path.startswith("/api"):
            if os.path.isfile(_INDEX):
                return FileResponse(_INDEX)
        from fastapi.responses import JSONResponse

        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
