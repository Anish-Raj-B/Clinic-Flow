"""Scheduled email jobs (replacements for the two pg_cron Edge Functions).

Both endpoints require `Authorization: Bearer <service_role_key>` and are called
by pg_cron / pg_net or by any external scheduler.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request

from ..email import (
    EmailError,
    email_layout,
    escape_html,
    format_date,
    format_datetime,
    format_money,
    send_email,
)
from ..security import require_service_role
from ..supabase_rest import SupabaseError, supabase

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post("/send-reminders")
async def send_reminders(request: Request) -> dict:
    require_service_role(request)
    client = supabase()

    now = datetime.now(timezone.utc)
    horizon = now + timedelta(hours=24)

    try:
        appointments = await client.select(
            "appointments",
            {
                "select": (
                    "id,customer_id,starts_at,notes,"
                    "service:services(name),"
                    "staff:profiles!appointments_staff_id_fkey(full_name),"
                    "customer:profiles!appointments_customer_id_fkey(full_name)"
                ),
                "status": "in.(pending,confirmed)",
                "starts_at": f"gte.{now.isoformat()}",
                "order": "starts_at.asc",
            },
            service=True,
        )
    except SupabaseError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    # Apply the upper bound in Python so the filter is independent of URL
    # encoding of the timezone offset.
    horizon_dt = horizon
    appointments = [
        row
        for row in appointments
        if _parse(row.get("starts_at")) and _parse(row["starts_at"]) <= horizon_dt
    ]

    email_cache: dict[str, str | None] = {}
    sent = 0
    skipped = 0
    failures: list[str] = []

    for appointment in appointments:
        customer_id = appointment["customer_id"]
        if customer_id not in email_cache:
            email_cache[customer_id] = await client.get_user_email(customer_id)
        email = email_cache[customer_id]
        if not email:
            skipped += 1
            continue

        service = appointment.get("service") or {}
        staff = appointment.get("staff") or {}
        service_name = service.get("name") or "Appointment"
        when = format_datetime(appointment.get("starts_at", ""))

        body_html = f"""
          <p style="margin:0 0 16px;color:#475569;line-height:1.6;">
            This is a friendly reminder of your upcoming visit.
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
          </table>
          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
            If you can no longer attend, please cancel in ClinicFlow so someone else can use the slot.
          </p>
        """

        try:
            await send_email(
                to=email,
                subject=f"Reminder: {service_name} on {when}",
                html=email_layout("Appointment reminder", body_html),
            )
            sent += 1
        except EmailError as error:
            failures.append(f"{appointment.get('id')}: {error}")

    return {
        "checked": len(appointments),
        "sent": sent,
        "skipped": skipped,
        "failures": failures,
    }


@router.post("/send-low-stock-alert")
async def send_low_stock_alert(request: Request) -> dict:
    require_service_role(request)
    client = supabase()

    try:
        low_stock = await client.select(
            "low_stock_items",
            {
                "select": "id,name,sku,quantity,reorder_level,units_needed,unit_price",
                "order": "units_needed.desc",
            },
            service=True,
        )
        expiring = await client.select(
            "expiring_soon_items",
            {
                "select": "id,name,sku,quantity,expiry_date,days_until_expiry",
                "order": "days_until_expiry.asc",
            },
            service=True,
        )
        owners = await client.select(
            "profiles",
            {"select": "id,full_name", "role": "eq.owner"},
            service=True,
        )
    except SupabaseError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    if not low_stock and not expiring:
        return {"sent": 0, "reason": "Nothing to report"}
    if not owners:
        return {"sent": 0, "reason": "No owner accounts found"}

    low_stock_html = (
        '<p style="margin:0 0 16px;color:#64748b;font-size:13px;">No items below reorder level.</p>'
        if not low_stock
        else f"""<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 22px;font-size:13px;">
            <tr style="background:#f8fafc;color:#475569;text-align:left;">
              <th style="padding:8px;">Item</th>
              <th style="padding:8px;">SKU</th>
              <th style="padding:8px;text-align:right;">In stock</th>
              <th style="padding:8px;text-align:right;">Reorder at</th>
              <th style="padding:8px;text-align:right;">Order</th>
            </tr>
            {''.join(
                f'''<tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:8px;color:#0f172a;">{escape_html(item.get('name'))}</td>
                  <td style="padding:8px;color:#64748b;">{escape_html(item.get('sku'))}</td>
                  <td style="padding:8px;text-align:right;color:#b45309;font-weight:600;">{item.get('quantity')}</td>
                  <td style="padding:8px;text-align:right;color:#64748b;">{item.get('reorder_level')}</td>
                  <td style="padding:8px;text-align:right;color:#0f172a;font-weight:600;">+{item.get('units_needed')}</td>
                </tr>'''
                for item in low_stock
            )}
          </table>"""
    )

    expiring_html = (
        '<p style="margin:0;color:#64748b;font-size:13px;">Nothing expiring within 30 days.</p>'
        if not expiring
        else f"""<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr style="background:#f8fafc;color:#475569;text-align:left;">
              <th style="padding:8px;">Item</th>
              <th style="padding:8px;">SKU</th>
              <th style="padding:8px;text-align:right;">Qty</th>
              <th style="padding:8px;text-align:right;">Expires</th>
            </tr>
            {''.join(
                f'''<tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:8px;color:#0f172a;">{escape_html(item.get('name'))}</td>
                  <td style="padding:8px;color:#64748b;">{escape_html(item.get('sku'))}</td>
                  <td style="padding:8px;text-align:right;color:#64748b;">{item.get('quantity')}</td>
                  <td style="padding:8px;text-align:right;color:{'#be123c' if int(item.get('days_until_expiry') or 0) <= 7 else '#b45309'};font-weight:600;">
                    {escape_html(format_date(item['expiry_date']) if item.get('expiry_date') else '—')}
                    ({'expired' if int(item.get('days_until_expiry') or 0) < 0 else str(item.get('days_until_expiry')) + 'd'})
                  </td>
                </tr>'''
                for item in expiring
            )}
          </table>"""
    )

    restock_value = sum(
        int(item.get("units_needed") or 0) * float(item.get("unit_price") or 0)
        for item in low_stock
    )

    body_html = f"""
      <p style="margin:0 0 16px;color:#475569;line-height:1.6;">
        Here is your inventory digest. Estimated cost to reach reorder level:
        <strong>{escape_html(format_money(restock_value))}</strong>
      </p>
      <h2 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Low stock ({len(low_stock)})</h2>
      {low_stock_html}
      <h2 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Expiring soon ({len(expiring)})</h2>
      {expiring_html}
      <p style="margin:18px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
        Open ClinicFlow → Inventory to record deliveries, remove expired stock and update reorder
        levels.
      </p>
    """

    sent = 0
    failures: list[str] = []

    for owner in owners:
        email = await client.get_user_email(owner["id"])
        if not email:
            continue
        try:
            await send_email(
                to=email,
                subject=f"Inventory digest · {len(low_stock)} low stock, {len(expiring)} expiring",
                html=email_layout(f"Inventory digest for {owner.get('full_name', '')}", body_html),
            )
            sent += 1
        except EmailError as error:
            failures.append(f"{owner.get('id')}: {error}")

    return {
        "low_stock": len(low_stock),
        "expiring": len(expiring),
        "owners": len(owners),
        "sent": sent,
        "failures": failures,
    }


def _parse(value: object) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed
