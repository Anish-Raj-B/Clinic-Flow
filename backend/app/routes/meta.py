"""Health check and public runtime configuration."""

from __future__ import annotations

import json

from fastapi import APIRouter, Response

from ..config import get_settings

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/health")
async def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "supabase_configured": settings.supabase_configured,
        "admin_configured": settings.admin_configured,
        "email_configured": settings.email_configured,
    }


@router.get("/config")
async def config() -> dict:
    """Public values only: anon key and clinic branding. Never secrets."""
    return get_settings().public_config()


@router.get("/config.js")
async def config_js() -> Response:
    """Synchronous config for index.html, so the app boots without a fetch."""
    payload = json.dumps(get_settings().public_config()).replace("</", "<\\/")
    body = f"window.__CLINICFLOW_CONFIG__ = {payload};\n"
    return Response(
        content=body,
        media_type="application/javascript; charset=utf-8",
        headers={"Cache-Control": "no-store"},
    )
