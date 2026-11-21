/**
 * Resend transactional email helpers plus HTML-safe rendering utilities.
 * All user-supplied text is escaped before it reaches the template.
 */

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
}

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function clinicName(): string {
  return Deno.env.get('CLINIC_NAME') ?? 'ClinicFlow Clinic';
}

export function clinicTimeZone(): string {
  return Deno.env.get('CLINIC_TIMEZONE') ?? 'UTC';
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: clinicTimeZone(),
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDate(dateString: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${dateString}T12:00:00Z`));
  } catch {
    return dateString;
  }
}

export function formatMoney(value: number): string {
  const currency = Deno.env.get('CLINIC_CURRENCY') ?? 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** Wraps content in the ClinicFlow email shell. `bodyHtml` must be safe HTML. */
export function emailLayout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#2278eb;padding:22px 32px;color:#ffffff;font-size:20px;font-weight:700;">
                ${escapeHtml(clinicName())}
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;color:#0f172a;">
                <h1 style="margin:0 0 14px;font-size:20px;">${escapeHtml(heading)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#f8fafc;color:#94a3b8;font-size:12px;line-height:1.5;">
                This message was sent by ClinicFlow on behalf of ${escapeHtml(clinicName())}.
                Please do not reply to this automated email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Sends one email through the Resend API. Throws on any failure. */
export async function sendEmail({ to, subject, html }: EmailInput): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured. Set it with `supabase secrets set`.');
  }

  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'ClinicFlow <onboarding@resend.dev>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend responded ${response.status}: ${detail.slice(0, 300)}`);
  }
}
