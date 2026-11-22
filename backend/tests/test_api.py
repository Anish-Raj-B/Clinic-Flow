"""HTTP-level tests: routing, security, config exposure and SPA fallback."""

from __future__ import annotations


def test_health_reports_configuration(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["supabase_configured"] is True
    assert body["admin_configured"] is True
    assert body["email_configured"] is False


def test_public_config_never_exposes_secrets(client):
    response = client.get("/api/config")
    assert response.status_code == 200
    body = response.json()
    assert body["SUPABASE_ANON_KEY"] == "test-anon-key"
    assert body["CLINIC_NAME"] == "Test Clinic"
    assert body["CLINIC_TIMEZONE"] == "UTC"
    serialized = str(body)
    assert "test-service-role-key" not in serialized


def test_config_js_is_javascript_and_globals(client):
    response = client.get("/api/config.js")
    assert response.status_code == 200
    assert "javascript" in response.headers["content-type"]
    assert "window.__CLINICFLOW_CONFIG__" in response.text
    assert "test-anon-key" in response.text
    assert "test-service-role-key" not in response.text


def test_scheduled_jobs_require_service_role(client):
    for path in ("/api/jobs/send-reminders", "/api/jobs/send-low-stock-alert"):
        assert client.post(path).status_code == 401
        assert client.post(path, headers={"Authorization": "Bearer wrong"}).status_code == 401


def test_booking_confirmation_requires_auth(client):
    # Authentication is checked before body validation, like the Edge Function.
    assert client.post("/api/notifications/booking-confirmation", json={}).status_code == 401
    response = client.post(
        "/api/notifications/booking-confirmation",
        json={"appointment_id": "eeeeeee1-0000-4000-8000-000000000001"},
    )
    assert response.status_code == 401


def test_security_headers_present(client):
    response = client.get("/api/health")
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]
    assert "https://*.supabase.co" in response.headers["Content-Security-Policy"]


def test_spa_fallback_serves_index_and_hides_unknown_api(client):
    response = client.get("/app/dashboard")
    assert response.status_code == 200
    assert "ClinicFlow" in response.text
    assert response.headers["cache-control"] == "no-store"

    unknown = client.get("/api/does-not-exist")
    assert unknown.status_code == 404
    assert unknown.json()["detail"] == "Not Found"


def test_static_assets_are_served(client):
    css = client.get("/css/styles.css")
    assert css.status_code == 200
    assert "--brand-600" in css.text

    app_js = client.get("/js/app.js")
    assert app_js.status_code == 200
    assert "initAuth" in app_js.text

    favicon = client.get("/assets/favicon.svg")
    assert favicon.status_code == 200
