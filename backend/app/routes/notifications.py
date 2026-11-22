"""Booking confirmation email endpoint.

Replaces the `send-booking-confirmation` Edge Function. The caller's JWT is used
for an RLS-scoped read of the appointment; only when that succeeds do we use the
service role to look up the customer's email and send the message.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ..email import (
    EmailError,
    email_layout,
    escape_html,
    format_datetime,
    format_money,
    send_email,
)
from ..security import require_user
from ..supabase_rest import SupabaseError, supabase

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class BookingConfirmationRequest(BaseModel):
    appointment_id: str = Field(min_length=8, max_length=64)


@router.post("/booking-confirmation")
async def booking_confirmation(
    request: Request,
    payload: BookingConfirmationRequest,
    _user: dict = Depends(require_user),
) -> dict:
    authorization = request.headers.get("authorization") or ""
    token = authorization[7:].strip()
    client = supabase()

    try:
        visible = await client.select(
            "appointments",
            {"select": "id", "id": f"eq.{payload.appointment_id}"},
            token=token,
        )
    except SupabaseError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    if not visible:
        raise HTTPException(status_code=403, detail="Appointment not found")

    try:
        rows = await client.select(
            "appointments",
            {
                "select": (
                    "customer_id,starts_at,status,notes,"
                    "service:services(name,price),"
                    "staff:profiles!appointments_staff_id_fkey(full_name)"
                ),
                "id": f"eq.{payload.appointment_id}",
            },
            service=True,
        )
    except SupabaseError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    if not rows:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appointment = rows[0]
    customer_email = await client.get_user_email(appointment["customer_id"])
    if not customer_email:
        return {"sent": False, "reason": "Customer email unavailable"}

    service = appointment.get("service") or {}
    staff = appointment.get("staff") or {}
    service_name = service.get("name") or "Appointment"
    when = format_datetime(appointment.get("starts_at", ""))
    price = format_money(service["price"]) if service.get("price") is not None else None

    body_html = f"""
      <p style="margin:0 0 16px;color:#475569;line-height:1.6;">
        Your appointment request has been received. The clinic will confirm it shortly.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border-radius:12px;padding:16px;margin:0 0 18px;">
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Service</td>
          <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">{escape_html(service_name)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">When</td>
          <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">{escape_html(when)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Practitioner</td>
          <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">{escape_html(staff.get("full_name") or "Clinic team")}</td>
        </tr>
        {f'<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Price</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">{escape_html(price)}</td></tr>' if price else ''}
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Status</td>
          <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">{escape_html(appointment.get("status", ""))}</td>
        </tr>
      </table>
      <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
        Need to change your plans? Open ClinicFlow, go to “My appointments” and cancel. The slot is
        released immediately for other patients.
      </p>
    """

    try:
        await send_email(
            to=customer_email,
            subject=f"Appointment received · {service_name} on {when}",
            html=email_layout("Your appointment request", body_html),
        )
    except EmailError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return {"sent": True}
