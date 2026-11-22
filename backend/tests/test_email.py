from app.email import (
    email_layout,
    escape_html,
    format_date,
    format_datetime,
    format_money,
)


def test_escape_html_covers_all_dangerous_characters():
    assert escape_html("<script>alert('x')</script>") == (
        "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;"
    )
    assert escape_html(None) == ""
    assert escape_html('a & b "c"') == "a &amp; b &quot;c&quot;"


def test_email_layout_escapes_heading_and_includes_branding():
    html = email_layout("Hello <b>", "<p>Body</p>")
    assert "Test Clinic" in html
    assert "Hello &lt;b&gt;" in html
    assert "<p>Body</p>" in html


def test_format_date_matches_original_output():
    assert format_date("2026-03-01") == "Mar 1, 2026"


def test_format_datetime_uses_clinic_timezone():
    # CLINIC_TIMEZONE=UTC in tests.
    assert format_datetime("2026-03-01T09:30:00.000Z") == "Sun, Mar 1, 2026, 9:30 AM"
    assert format_datetime("not-a-date") == "not-a-date"


def test_format_money_uses_currency_symbol():
    assert format_money(121) == "$121.00"
    assert format_money(4.5) == "$4.50"
