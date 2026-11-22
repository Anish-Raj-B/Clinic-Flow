/**
 * Supabase data access. Centralises every query/RPC used by the pages so the
 * business logic stays identical to the original React components.
 */

import { API_BASE } from "./config.js";
import { supabase } from "./supabase.js";

export const APPOINTMENT_SELECT =
  "*, service:services(id, name, duration_minutes, price), staff:profiles!appointments_staff_id_fkey(id, full_name), customer:profiles!appointments_customer_id_fkey(id, full_name, phone)";

export const INVOICE_SELECT =
  "*, customer:profiles!invoices_customer_id_fkey(id, full_name, phone), appointment:appointments!invoices_appointment_id_fkey(id, starts_at), invoice_items(*)";

/* -------------------------------------------------------------------------- */
/* Services & practitioners                                                   */
/* -------------------------------------------------------------------------- */

export async function listServices({ activeOnly = false } = {}) {
  let query = supabase.from("services").select("*");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query.order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listServicesForAdmin() {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("active", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveService(payload, id) {
  if (id) {
    const { error } = await supabase.from("services").update(payload).eq("id", id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("services").insert(payload);
  if (error) throw error;
}

export async function deleteService(id) {
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleServiceActive(id, active) {
  const { error } = await supabase.from("services").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function listPractitioners({ withRole = false } = {}) {
  const columns = withRole ? "id, full_name, role" : "id, full_name";
  const { data, error } = await supabase
    .from("profiles")
    .select(columns)
    .in("role", ["staff", "owner"])
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

/* -------------------------------------------------------------------------- */
/* Slots & appointments                                                       */
/* -------------------------------------------------------------------------- */

export async function listAvailableSlots(serviceId, staffId, date) {
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_service_id: serviceId,
    p_staff_id: staffId,
    p_date: date,
  });
  if (error) throw error;
  return data || [];
}

export async function bookAppointment({ serviceId, staffId, startsAt, notes }) {
  const { data, error } = await supabase.rpc("book_appointment", {
    p_service_id: serviceId,
    p_staff_id: staffId,
    p_starts_at: startsAt,
    p_notes: notes || null,
  });
  if (error) throw error;
  return data;
}

export async function cancelAppointment(appointmentId) {
  const { error } = await supabase.rpc("cancel_appointment", {
    p_appointment_id: appointmentId,
  });
  if (error) throw error;
}

export async function listAppointments({ from, to, status, staffId, limit = 300 } = {}) {
  let query = supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (from) query = query.gte("starts_at", from);
  if (to) query = query.lt("starts_at", to);
  if (status && status !== "all") query = query.eq("status", status);
  if (staffId && staffId !== "all") query = query.eq("staff_id", staffId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listMyAppointments() {
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateAppointmentStatus(id, status) {
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
  if (error) throw error;
}

/**
 * Best-effort booking confirmation email. The Python backend verifies the
 * caller's JWT by re-reading the appointment under RLS before sending.
 */
export async function notifyBookingConfirmation(appointmentId) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session && data.session.access_token;
    if (!token) return;
    await fetch(`${API_BASE}/api/notifications/booking-confirmation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ appointment_id: appointmentId }),
    });
  } catch {
    // Email delivery is best-effort; the booking is already committed.
  }
}

/* -------------------------------------------------------------------------- */
/* Invoices                                                                   */
/* -------------------------------------------------------------------------- */

export async function listInvoices(limit = 300) {
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function createInvoice({ customerId, appointmentId, taxRate, items }) {
  const { error } = await supabase.rpc("create_invoice", {
    p_customer_id: customerId,
    p_appointment_id: appointmentId || null,
    p_tax_rate: taxRate,
    p_items: items.map((item) => ({
      description: String(item.description).trim(),
      quantity: item.quantity,
      unit_price: item.unitPrice,
    })),
  });
  if (error) throw error;
}

export async function markInvoicePaid(id) {
  const { error } = await supabase.from("invoices").update({ status: "paid" }).eq("id", id);
  if (error) throw error;
}

export async function listCustomers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "customer")
    .order("full_name");
  if (error) throw error;
  return data || [];
}

export async function listInvoiceableAppointments(limit = 300) {
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, customer_id, status, service:services(id, name, price), customer:profiles!appointments_customer_id_fkey(id, full_name)",
    )
    .order("starts_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/* -------------------------------------------------------------------------- */
/* Inventory                                                                  */
/* -------------------------------------------------------------------------- */

export async function listInventory() {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function insertInventoryItem(payload) {
  const { error } = await supabase.from("inventory_items").insert(payload);
  if (error) throw error;
}

export async function updateInventoryItem(id, payload) {
  const { error } = await supabase.from("inventory_items").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteInventoryItem(id) {
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) throw error;
}

export async function insertStockMovement({ itemId, change, reason, createdBy }) {
  const { error } = await supabase.from("inventory_movements").insert({
    item_id: itemId,
    change,
    reason,
    created_by: createdBy || null,
  });
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Dashboard & reporting                                                      */
/* -------------------------------------------------------------------------- */

export async function listLowStock() {
  const { data, error } = await supabase
    .from("low_stock_items")
    .select("*")
    .order("units_needed", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listExpiringSoon() {
  const { data, error } = await supabase
    .from("expiring_soon_items")
    .select("*")
    .order("days_until_expiry", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listDailyRevenue(since) {
  let query = supabase.from("daily_revenue").select("*");
  if (since) query = query.gte("day", since);
  const { data, error } = await query.order("day", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listBusiestHours() {
  const { data, error } = await supabase.from("busiest_hours").select("*").order("hour");
  if (error) throw error;
  return data || [];
}

export async function listAppointmentRows(since) {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, status, starts_at")
    .gte("starts_at", `${since}T00:00:00.000Z`)
    .limit(2000);
  if (error) throw error;
  return data || [];
}

export async function listInvoiceRows(since) {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, total, status, created_at")
    .gte("created_at", `${since}T00:00:00.000Z`)
    .limit(2000);
  if (error) throw error;
  return data || [];
}

export async function listInvoiceItemRows() {
  const { data, error } = await supabase
    .from("invoice_items")
    .select("description, quantity, unit_price, invoice:invoices(id, status)")
    .limit(2000);
  if (error) throw error;
  return data || [];
}

/* -------------------------------------------------------------------------- */
/* Profiles, roles & availability                                             */
/* -------------------------------------------------------------------------- */

export async function listProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listAvailability() {
  const { data, error } = await supabase
    .from("staff_availability")
    .select("*")
    .order("weekday", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function updateProfileRole(id, role) {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function addAvailability({ staffId, weekday, startTime, endTime }) {
  const { error } = await supabase.from("staff_availability").insert({
    staff_id: staffId,
    weekday,
    start_time: `${startTime.slice(0, 5)}:00`,
    end_time: `${endTime.slice(0, 5)}:00`,
  });
  if (error) throw error;
}

export async function removeAvailability(id) {
  const { error } = await supabase.from("staff_availability").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Audit logs                                                                 */
/* -------------------------------------------------------------------------- */

export async function listAuditLogs({ tableName, action, limit = 200 } = {}) {
  let query = supabase
    .from("audit_logs")
    .select("*, user:profiles!audit_logs_user_id_fkey(id, full_name, role)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (tableName && tableName !== "all") query = query.eq("table_name", tableName);
  if (action && action !== "all") query = query.eq("action", action);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
