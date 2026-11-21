import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { handleOptions, jsonResponse, errorMessage } from '../_shared/http.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { emailLayout, escapeHtml, formatDateTime, formatMoney, sendEmail } from '../_shared/email.ts';

interface RequestBody {
  appointment_id?: string;
}

interface VisibleAppointment {
  id: string;
}

interface AppointmentDetail {
  customer_id: string;
  starts_at: string;
  status: string;
  notes: string | null;
  service: { name: string; price: number } | null;
  staff: { full_name: string } | null;
}

/**
 * POST /functions/v1/send-booking-confirmation
 * Body: { appointment_id: string }
 *
 * Called by the signed-in browser after a successful booking. The caller's JWT
 * is used with the anon client so RLS decides whether the appointment is
 * visible; only then do we look up the customer email with the service role.
 */
Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (!body.appointment_id) {
      return jsonResponse({ error: 'appointment_id is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !anonKey) {
      return jsonResponse({ error: 'Function is not configured' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: visible, error: visibilityError } = await userClient
      .from('appointments')
      .select('id')
      .eq('id', body.appointment_id)
      .maybeSingle<VisibleAppointment>();

    if (visibilityError) throw visibilityError;
    if (!visible) {
      return jsonResponse({ error: 'Appointment not found' }, 403);
    }

    const admin = createAdminClient();

    const { data: appointment, error: appointmentError } = await admin
      .from('appointments')
      .select(
        'customer_id, starts_at, status, notes, service:services(name, price), staff:profiles!appointments_staff_id_fkey(full_name)',
      )
      .eq('id', body.appointment_id)
      .single<AppointmentDetail>();

    if (appointmentError) throw appointmentError;
    if (!appointment) {
      return jsonResponse({ error: 'Appointment not found' }, 404);
    }

    const { data: customerUser, error: userError } = await admin.auth.admin.getUserById(
      appointment.customer_id,
    );

    if (userError || !customerUser.user?.email) {
      return jsonResponse({ sent: false, reason: 'Customer email unavailable' }, 200);
    }

    const serviceName = appointment.service?.name ?? 'Appointment';
    const when = formatDateTime(appointment.starts_at);
    const price = appointment.service ? formatMoney(appointment.service.price) : null;

    const bodyHtml = `
      <p style="margin:0 0 16px;color:#475569;line-height:1.6;">
        Your appointment request has been received. The clinic will confirm it shortly.
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
        ${price ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Price</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(price)}</td></tr>` : ''}
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Status</td>
          <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(appointment.status)}</td>
        </tr>
      </table>
      <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
        Need to change your plans? Open ClinicFlow, go to “My appointments” and cancel. The slot is
        released immediately for other patients.
      </p>
    `;

    await sendEmail({
      to: customerUser.user.email,
      subject: `Appointment received · ${serviceName} on ${when}`,
      html: emailLayout('Your appointment request', bodyHtml),
    });

    return jsonResponse({ sent: true });
  } catch (error) {
    return jsonResponse({ error: errorMessage(error) }, 500);
  }
});
