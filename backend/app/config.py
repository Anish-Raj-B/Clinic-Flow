"""Runtime configuration for the ClinicFlow Python backend.

Values come from environment variables (or a project-root .env file). Only the
Supabase anon key and clinic branding are ever sent to the browser; the service
role key and Resend key stay server-side.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIR = PROJECT_ROOT / "frontend"

load_dotenv(PROJECT_ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


@dataclass(frozen=True)
class Settings:
    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # Email (Resend)
    resend_api_key: str
    resend_from_email: str

    # Clinic branding
    clinic_name: str
    clinic_address: str
    clinic_phone: str
    clinic_email: str
    clinic_currency: str
    clinic_timezone: str

    # Server
    app_origin: str
    api_base_url: str
    host: str
    port: int

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)

    @property
    def admin_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def email_configured(self) -> bool:
        return bool(self.resend_api_key)

    def public_config(self) -> dict[str, str]:
        """Values safe to expose in the browser (no secrets)."""
        return {
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_ANON_KEY": self.supabase_anon_key,
            "CLINIC_NAME": self.clinic_name,
            "CLINIC_ADDRESS": self.clinic_address,
            "CLINIC_PHONE": self.clinic_phone,
            "CLINIC_EMAIL": self.clinic_email,
            "CLINIC_CURRENCY": self.clinic_currency,
            "CLINIC_TIMEZONE": self.clinic_timezone,
            "API_BASE_URL": self.api_base_url,
        }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        supabase_url=_env("SUPABASE_URL"),
        supabase_anon_key=_env("SUPABASE_ANON_KEY"),
        supabase_service_role_key=_env("SUPABASE_SERVICE_ROLE_KEY"),
        resend_api_key=_env("RESEND_API_KEY"),
        resend_from_email=_env("RESEND_FROM_EMAIL", "ClinicFlow <onboarding@resend.dev>"),
        clinic_name=_env("CLINIC_NAME", "ClinicFlow Clinic"),
        clinic_address=_env("CLINIC_ADDRESS", "12 Health Street, Suite 4"),
        clinic_phone=_env("CLINIC_PHONE", "+1 (555) 010-2030"),
        clinic_email=_env("CLINIC_EMAIL", "billing@clinicflow.example"),
        clinic_currency=_env("CLINIC_CURRENCY", "USD"),
        clinic_timezone=_env("CLINIC_TIMEZONE", "UTC"),
        app_origin=_env("APP_ORIGIN", f"http://localhost:{_env('PORT', '8000')}"),
        api_base_url=_env("API_BASE_URL", ""),
        host=_env("HOST", "127.0.0.1"),
        port=int(_env("PORT", "8000") or 8000),
    )
