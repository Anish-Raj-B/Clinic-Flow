"""Transactional email helpers (Resend) — Python port of the Edge Function module.

Every interpolated value is HTML-escaped; dates and money follow the clinic
timezone/currency settings.
"""

from __future__ import annotations

from datetime import datetime, tzinfo, timezone
from zoneinfo import ZoneInfo

import httpx

from .config import get_settings

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
]

CURRENCY_SYMBOLS = {"USD": "$", "GBP": "£", "EUR": "€", "INR": "₹", "NGN": "₦", "KES": "KSh"}


def escape_html(value: object) -> str:
    if value is None:
        return ""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _parse_iso(value: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _zone() -> tzinfo:
    """Clinic timezone, falling back to UTC when tzdata is unavailable."""
    try:
        return ZoneInfo(get_settings().clinic_timezone)
    except Exception:  # invalid zone name or missing tzdata
        return timezone.utc


def _hour12(hour: int) -> tuple[int, str]:
    if hour == 0:
        return 12, "AM"
    if hour < 12:
        return hour, "AM"
    if hour == 12:
        return 12, "PM"
    return hour - 12, "PM"


def format_datetime(iso: str) -> str:
    parsed = _parse_iso(iso)
    if parsed is None:
        return str(iso)
    local = parsed.astimezone(_zone())
    hour, meridiem = _hour12(local.hour)
    return (
        f"{WEEKDAYS[local.weekday()]}, {MONTHS[local.month - 1]} {local.day}, "
        f"{local.year}, {hour}:{local.minute:02d} {meridiem}"
    )


def format_date(date_string: str) -> str:
    try:
        parsed = datetime.fromisoformat(str(date_string)[:10])
    except ValueError:
        return str(date_string)
    return f"{MONTHS[parsed.month - 1]} {parsed.day}, {parsed.year}"


def format_money(value: float) -> str:
    currency = get_settings().clinic_currency.upper()
    symbol = CURRENCY_SYMBOLS.get(currency)
    amount = f"{float(value):,.2f}"
    if symbol:
        return f"{symbol}{amount}"
    return f"{amount} {currency}"


def clinic_name() -> str:
    return get_settings().clinic_name


def email_layout(heading: str, body_html: str) -> str:
    """Wraps safe content in the ClinicFlow email shell."""
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{escape_html(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#2278eb;padding:22px 32px;color:#ffffff;font-size:20px;font-weight:700;">
                {escape_html(clinic_name())}
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;color:#0f172a;">
                <h1 style="margin:0 0 14px;font-size:20px;">{escape_html(heading)}</h1>
                {body_html}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#f8fafc;color:#94a3b8;font-size:12px;line-height:1.5;">
                This message was sent by ClinicFlow on behalf of {escape_html(clinic_name())}.
                Please do not reply to this automated email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


class EmailError(RuntimeError):
    """Raised when Resend is unconfigured or rejects the message."""


async def send_email(to: str, subject: str, html: str) -> None:
    settings = get_settings()
    if not settings.resend_api_key:
        raise EmailError(
            "RESEND_API_KEY is not configured. Set it in the backend environment."
        )
    payload = {
        "from": settings.resend_from_email,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if response.status_code >= 400:
        raise EmailError(
            f"Resend responded {response.status_code}: {response.text[:300]}"
        )
