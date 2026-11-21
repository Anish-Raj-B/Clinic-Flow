import { handleOptions, jsonResponse, errorMessage } from '../_shared/http.ts';
import { createAdminClient, isServiceRoleRequest } from '../_shared/supabase.ts';
import {
  emailLayout,
  escapeHtml,
  formatDate,
  formatMoney,
  sendEmail,
} from '../_shared/email.ts';

interface LowStockRow {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorder_level: number;
  units_needed: number;
  unit_price: number;
}

interface ExpiringRow {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  expiry_date: string | null;
  days_until_expiry: number;
}

interface OwnerRow {
  id: string;
  full_name: string;
}

/**
 * POST /functions/v1/send-low-stock-alert
 * Scheduled weekly by pg_cron. Emails every owner a digest of items at or
 * below reorder level plus stock expiring within 30 days.
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

    const [lowStockResult, expiringResult, ownersResult] = await Promise.all([
      admin
        .from('low_stock_items')
        .select('id, name, sku, quantity, reorder_level, units_needed, unit_price')
        .order('units_needed', { ascending: false })
        .returns<LowStockRow[]>(),
      admin
        .from('expiring_soon_items')
        .select('id, name, sku, quantity, expiry_date, days_until_expiry')
        .order('days_until_expiry', { ascending: true })
        .returns<ExpiringRow[]>(),
      admin.from('profiles').select('id, full_name').eq('role', 'owner').returns<OwnerRow[]>(),
    ]);

    if (lowStockResult.error) throw lowStockResult.error;
    if (expiringResult.error) throw expiringResult.error;
    if (ownersResult.error) throw ownersResult.error;

    const lowStock = lowStockResult.data ?? [];
    const expiring = expiringResult.data ?? [];
    const owners = ownersResult.data ?? [];

    if (lowStock.length === 0 && expiring.length === 0) {
      return jsonResponse({ sent: 0, reason: 'Nothing to report' });
    }

    if (owners.length === 0) {
      return jsonResponse({ sent: 0, reason: 'No owner accounts found' });
    }

    const lowStockHtml =
      lowStock.length === 0
        ? '<p style="margin:0 0 16px;color:#64748b;font-size:13px;">No items below reorder level.</p>'
        : `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 22px;font-size:13px;">
            <tr style="background:#f8fafc;color:#475569;text-align:left;">
              <th style="padding:8px;">Item</th>
              <th style="padding:8px;">SKU</th>
              <th style="padding:8px;text-align:right;">In stock</th>
              <th style="padding:8px;text-align:right;">Reorder at</th>
              <th style="padding:8px;text-align:right;">Order</th>
            </tr>
            ${lowStock
              .map(
                (item) => `<tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:8px;color:#0f172a;">${escapeHtml(item.name)}</td>
                  <td style="padding:8px;color:#64748b;">${escapeHtml(item.sku)}</td>
                  <td style="padding:8px;text-align:right;color:#b45309;font-weight:600;">${item.quantity}</td>
                  <td style="padding:8px;text-align:right;color:#64748b;">${item.reorder_level}</td>
                  <td style="padding:8px;text-align:right;color:#0f172a;font-weight:600;">+${item.units_needed}</td>
                </tr>`,
              )
              .join('')}
          </table>`;

    const expiringHtml =
      expiring.length === 0
        ? '<p style="margin:0;color:#64748b;font-size:13px;">Nothing expiring within 30 days.</p>'
        : `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr style="background:#f8fafc;color:#475569;text-align:left;">
              <th style="padding:8px;">Item</th>
              <th style="padding:8px;">SKU</th>
              <th style="padding:8px;text-align:right;">Qty</th>
              <th style="padding:8px;text-align:right;">Expires</th>
            </tr>
            ${expiring
              .map(
                (item) => `<tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:8px;color:#0f172a;">${escapeHtml(item.name)}</td>
                  <td style="padding:8px;color:#64748b;">${escapeHtml(item.sku)}</td>
                  <td style="padding:8px;text-align:right;color:#64748b;">${item.quantity}</td>
                  <td style="padding:8px;text-align:right;color:${item.days_until_expiry <= 7 ? '#be123c' : '#b45309'};font-weight:600;">
                    ${escapeHtml(item.expiry_date ? formatDate(item.expiry_date) : '—')}
                    (${item.days_until_expiry < 0 ? 'expired' : `${item.days_until_expiry}d`})
                  </td>
                </tr>`,
              )
              .join('')}
          </table>`;

    const restockValue = lowStock.reduce(
      (sum, item) => sum + item.units_needed * Number(item.unit_price),
      0,
    );

    const bodyHtml = `
      <p style="margin:0 0 16px;color:#475569;line-height:1.6;">
        Here is your inventory digest. Estimated cost to reach reorder level:
        <strong>${escapeHtml(formatMoney(restockValue))}</strong>
      </p>
      <h2 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Low stock (${lowStock.length})</h2>
      ${lowStockHtml}
      <h2 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Expiring soon (${expiring.length})</h2>
      ${expiringHtml}
      <p style="margin:18px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
        Open ClinicFlow → Inventory to record deliveries, remove expired stock and update reorder
        levels.
      </p>
    `;

    let sent = 0;
    const failures: string[] = [];

    for (const owner of owners) {
      const { data: userResult, error: userError } = await admin.auth.admin.getUserById(owner.id);
      const email = userError ? null : (userResult.user?.email ?? null);
      if (!email) continue;

      try {
        await sendEmail({
          to: email,
          subject: `Inventory digest · ${lowStock.length} low stock, ${expiring.length} expiring`,
          html: emailLayout(`Inventory digest for ${owner.full_name}`, bodyHtml),
        });
        sent += 1;
      } catch (sendError) {
        failures.push(`${owner.id}: ${errorMessage(sendError)}`);
      }
    }

    return jsonResponse({
      low_stock: lowStock.length,
      expiring: expiring.length,
      owners: owners.length,
      sent,
      failures,
    });
  } catch (error) {
    return jsonResponse({ error: errorMessage(error) }, 500);
  }
});
