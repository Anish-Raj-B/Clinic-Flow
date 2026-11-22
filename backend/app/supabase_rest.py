"""Minimal async Supabase client built on httpx.

Uses PostgREST for table reads, GoTrue for user lookups. This keeps the backend
dependency-light and makes the trust boundary explicit: requests made with a
user's JWT are subject to Row Level Security, while service-role requests are
only issued from the scheduled/notification endpoints.
"""

from __future__ import annotations

from typing import Any

import httpx

from .config import get_settings


class SupabaseError(RuntimeError):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


class SupabaseREST:
    def __init__(self, timeout: float = 20.0) -> None:
        settings = get_settings()
        self.base_url = settings.supabase_url.rstrip("/")
        self.anon_key = settings.supabase_anon_key
        self.service_key = settings.supabase_service_role_key
        self.timeout = timeout

    # -- headers ---------------------------------------------------------
    def _headers(self, token: str | None = None, service: bool = False) -> dict[str, str]:
        if service:
            key = self.service_key
            if not key:
                raise SupabaseError("SUPABASE_SERVICE_ROLE_KEY is not configured", 500)
        else:
            key = self.anon_key
            if not key:
                raise SupabaseError("SUPABASE_ANON_KEY is not configured", 500)
        headers = {"apikey": key, "Accept": "application/json"}
        headers["Authorization"] = f"Bearer {token or key}"
        return headers

    # -- PostgREST -------------------------------------------------------
    async def select(
        self,
        table: str,
        params: dict[str, str],
        *,
        token: str | None = None,
        service: bool = False,
    ) -> list[dict[str, Any]]:
        if not self.base_url:
            raise SupabaseError("SUPABASE_URL is not configured", 500)
        url = f"{self.base_url}/rest/v1/{table}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                url, params=params, headers=self._headers(token, service)
            )
        if response.status_code >= 400:
            raise SupabaseError(
                f"Supabase select on {table} failed ({response.status_code}): "
                f"{response.text[:300]}",
                response.status_code,
            )
        data = response.json()
        if isinstance(data, dict):
            return [data]
        return data

    # -- GoTrue ----------------------------------------------------------
    async def get_user(self, token: str) -> dict[str, Any] | None:
        """Resolve a user JWT to its auth user; None when invalid/expired."""
        if not self.base_url or not self.anon_key:
            return None
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/auth/v1/user",
                headers={"apikey": self.anon_key, "Authorization": f"Bearer {token}"},
            )
        if response.status_code != 200:
            return None
        user = response.json()
        return user if isinstance(user, dict) and user.get("id") else None

    async def get_user_email(self, user_id: str) -> str | None:
        """Service-role lookup of an auth user's email address."""
        headers = self._headers(service=True)
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/auth/v1/admin/users/{user_id}", headers=headers
            )
        if response.status_code >= 400:
            return None
        payload = response.json()
        user = payload.get("user") if isinstance(payload, dict) else None
        if isinstance(user, dict) and user.get("email"):
            return str(user["email"])
        if isinstance(payload, dict) and payload.get("email"):
            return str(payload["email"])
        return None


def supabase() -> SupabaseREST:
    return SupabaseREST()
