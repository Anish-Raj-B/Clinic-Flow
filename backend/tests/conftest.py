"""Test configuration: deterministic public settings, no real network calls."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("SUPABASE_URL", "https://clinicflow-test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("RESEND_API_KEY", "")
os.environ.setdefault("CLINIC_NAME", "Test Clinic")
os.environ.setdefault("CLINIC_TIMEZONE", "UTC")
os.environ.setdefault("CLINIC_CURRENCY", "USD")
os.environ.setdefault("PORT", "8000")


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)
