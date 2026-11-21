import { handleOptions, jsonResponse, errorMessage } from '../_shared/http.ts';
import { createAdminClient, isServiceRoleRequest } from '../_shared/supabase.ts';
import { emailLayout, escapeHtml, formatDateTime, sendEmail } from '../_shared/email.ts';

interface ReminderRow {
  id: string;
  customer_id: string;
  starts_at: string;
  notes: string | null;
  service: { name: string } | null;
  staff: { full_name: string } | null;
  customer: { full_name: string } | null;
}

/**
 * POST /functions/v1/send-reminders
 * Scheduled daily by pg_cron. Emails every customer with a pending/confirmed
 * appointment in the next 24 hours. Requires the service role key.
 */
Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!isServiceRoleRequest(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const admin = createAdminClient();
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: appointments, error } = await admin
      .from('appointments')
      .select(
        'id, customer_id, starts_at, notes, service:services(name), staff:profiles!appointments_staff_id_fkey(full_name), customer:profiles!appointments_customer_id_fkey(full_name)',
      )
      .in('status', ['pending', 'confirmed'])
      .gte('starts_at', now.toISOString())
      .lte('starts_at', horizon.toISOString())
      .order('starts_at', { ascending: true })
      .returns<ReminderRow[]>();

    if (error) throw error;

    const emailCache = new Map<string, string | null>();
    let sent = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const appointment of appointments ?? []) {
      let email = emailCache.get(appointment.customer_id);
      if (email === undefined) {
        const { data: userResult, error: userError } = await admin.auth.admin.getUserById(
          appointment.customer_id,
        );
        email = userError ? null : (userResult.user?.email ?? null);
        emailCache.set(appointment.customer_id, email);
      }

      if (!email) {
        skipped += 1;
        continue;
      }

      const when = formatDateTime(appointment.starts_at);
      const serviceName = appointment.service?.name ?? 'Appointment';

      const bodyHtml = `
        <p style="margin:0 0 16px;color:#475569;line-height:1.6;">
          This is a friendly reminder of your upcoming visit.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border-radius:12px;padding:16px;margin:0 0 18px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">Service</td>
            <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(serviceName)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">When</td>
            <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(when)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">Practitioner</td>
            <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(appointment.staff?.full_name ?? 'Clinic team')}</td>
          </tr>
        </table>
        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
          If you can no longer attend, please cancel in ClinicFlow so someone else can use the slot.
        </p>
      `;

      try {
        await sendEmail({
          to: email,
          subject: `Reminder: ${serviceName} on ${when}`,
          html: emailLayout('Appointment reminder', bodyHtml),
        });
        sent += 1;
      } catch (sendError) {
        failures.push(`${appointment.id}: ${errorMessage(sendError)}`);
      }
    }

    return jsonResponse({
      checked: appointments?.length ?? 0,
      sent,
      skipped,
      failures,
    });
  } catch (error) {
    return jsonResponse({ error: errorMessage(error) }, 500);
  }
});
