"""Request authentication helpers."""

from __future__ import annotations

import hmac

from fastapi import HTTPException, Request

from .config import get_settings
from .supabase_rest import supabase


def bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization") or ""
    if not authorization.startswith("Bearer "):
        return None
    token = authorization[7:].strip()
    return token or None


def require_service_role(request: Request) -> None:
    """Scheduled jobs authenticate with the project's service role key."""
    expected = get_settings().supabase_service_role_key
    authorization = request.headers.get("authorization") or ""
    if not expected or not hmac.compare_digest(authorization, f"Bearer {expected}"):
        raise HTTPException(status_code=401, detail="Unauthorized")


async def require_user(request: Request) -> dict:
    """Resolve the caller's JWT to a Supabase auth user or raise 401."""
    token = bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    user = await supabase().get_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user
