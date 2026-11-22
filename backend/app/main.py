"""ClinicFlow FastAPI application: JSON/email API + static frontend hosting."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_DIR, get_settings
from .routes import jobs, meta, notifications

app = FastAPI(
    title="ClinicFlow",
    version="2.0.0",
    description=(
        "Appointment, inventory, billing and analytics backend. "
        "Supabase provides Postgres, Auth, RLS and storage; this service handles "
        "server-side email work and serves the static frontend."
    ),
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

settings = get_settings()

_origins = {
    settings.app_origin,
    f"http://localhost:{settings.port}",
    f"http://127.0.0.1:{settings.port}",
}
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(origin for origin in _origins if origin),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "apikey"],
)

app.include_router(meta.router)
app.include_router(notifications.router)
app.include_router(jobs.router)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    supabase = settings.supabase_url.rstrip("/")
    connect_src = f"'self' https://*.supabase.co wss://*.supabase.co"
    if supabase:
        connect_src = f"{connect_src} {supabase} {supabase.replace('https://', 'wss://')}"
    response.headers.setdefault(
        "Content-Security-Policy",
        "; ".join(
            [
                "default-src 'self'",
                "base-uri 'self'",
                "object-src 'none'",
                "script-src 'self'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob:",
                "font-src 'self' data:",
                f"connect-src {connect_src}",
                "frame-src 'none'",
                "frame-ancestors 'none'",
                "form-action 'self'",
            ]
        ),
    )
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"
    )
    response.headers.setdefault(
        "Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"
    )
    return response


if FRONTEND_DIR.exists():
    for folder in ("css", "js", "assets"):
        directory = FRONTEND_DIR / folder
        if directory.exists():
            app.mount(f"/{folder}", StaticFiles(directory=directory), name=folder)


def _index() -> FileResponse:
    return FileResponse(
        FRONTEND_DIR / "index.html",
        media_type="text/html",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/", include_in_schema=False)
async def root():
    return _index()


@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def spa_fallback(full_path: str):
    """Serve static files, and the SPA shell for client-side routes."""
    if full_path.startswith("api/"):
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    candidate = (FRONTEND_DIR / full_path).resolve()
    try:
        candidate.relative_to(FRONTEND_DIR.resolve())
    except ValueError:
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    if candidate.is_file():
        return FileResponse(candidate)

    if not (FRONTEND_DIR / "index.html").exists():
        return JSONResponse(
            {"detail": "Frontend build is missing. Expected frontend/index.html."},
            status_code=500,
        )
    return _index()
