/**
 * Staff workspace: dashboard, appointments, inventory and billing.
 * Feature-for-feature port of the React pages.
 */

import {
  appointmentStatusBadge,
  badge,
  button,
  cardHead,
  emptyState,
  inlineLoader,
  inputField,
  invoiceStatusBadge,
  openModal,
  pageHeader,
  selectField,
  showFieldErrors,
  spinner,
  statCard,
  textareaField,
} from "../components.js";
import { icon } from "../icons.js";
import * as api from "../api.js";
import { getAuth, toast } from "../store.js";
import {
  validateInventoryItem,
  validateInvoice,
  validateStockMovement,
} from "../validation.js";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_OPTIONS,
  addDays,
  computeInvoiceTotals,
  downloadCsv,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatInvoiceNumber,
  formatTime,
  getClinicDayRange,
  getErrorMessage,
  todayInClinicTimeZone,
} from "../utils.js";

/* ========================================================================== */
/* Dashboard                                                                  */
/* ========================================================================== */

export async function renderDashboard() {
  const { profile } = getAuth();
  const today = todayInClinicTimeZone();
  let data = { appointments: [], lowStock: [], expiring: [] };
  let loadError = "";

  try {
    const { start, end } = getClinicDayRange(today);
    const [appointments, lowStock, expiring] = await Promise.all([
      api.listAppointments({ from: start, to: end }),
      api.listLowStock(),
      api.listExpiringSoon(),
    ]);
    data = { appointments, lowStock, expiring };
  } catch (error) {
    loadError = getErrorMessage(error, "Could not load the dashboard");
  }

  const appointments = data.appointments;
  const confirmed = appointments.filter((item) => item.status === "confirmed").length;
  const completed = appointments.filter((item) => item.status === "completed").length;
  const nextAppointment =
    appointments.find((item) => item.status !== "cancelled") || appointments[0] || null;

  const html = `<div class="stack">
    ${pageHeader({
      title: `Good day, ${(profile && profile.full_name ? profile.full_name.split(" ")[0] : "team") || "team"}`,
      description: `Here is what ${formatDate(today)} looks like across the clinic.`,
      actions: `<a class="btn btn-outline" href="/app/appointments" data-link>${icon(
        "calendar",
        "icon-sm",
      )}Schedule</a><a class="btn btn-primary" href="/app/billing" data-link>${icon(
        "plus",
        "icon-sm",
      )}New invoice</a>`,
    })}

    ${
      loadError
        ? `<div class="card pad between" style="flex-wrap:wrap">
            <p class="small row" style="color:#e11d48">${icon("alert", "icon-sm")}${escapeHtml(
              loadError,
            )}</p>
            ${button("Try again", { size: "sm", variant: "outline", action: "reload" })}
          </div>`
        : ""
    }

    <div class="stat-grid">
      ${statCard({
        label: "Today's appointments",
        value: loadError ? "—" : appointments.length,
        hint: `${confirmed} confirmed · ${completed} completed`,
        iconName: "calendar",
      })}
      ${statCard({
        label: "Low stock items",
        value: loadError ? "—" : data.lowStock.length,
        hint: "At or below reorder level",
        tone: "amber",
        iconName: "box",
      })}
      ${statCard({
        label: "Expiring in 30 days",
        value: loadError ? "—" : data.expiring.length,
        hint: "Review or write off soon",
        tone: "rose",
        iconName: "pill",
      })}
      ${statCard({
        label: "Next appointment",
        value: loadError || appointments.length === 0 ? "—" : formatTime(nextAppointment.starts_at),
        hint: (appointments[0] && appointments[0].customer && appointments[0].customer.full_name) || "Nothing scheduled",
        tone: "accent",
        iconName: "clock",
      })}
    </div>

    <div class="grid" style="grid-template-columns:minmax(0,1fr)">
      <div class="card">
        ${cardHead({
          title: "Today's schedule",
          description: "Live view of every appointment booked for today.",
          actions: `<a class="btn-link" href="/app/appointments" data-link>Manage ${icon(
            "chevron",
            "icon-sm",
          )}</a>`,
        })}
        ${
          loadError
            ? inlineLoader("Retry to load today's schedule")
            : appointments.length === 0
              ? emptyState({
                  title: "No appointments today",
                  description: "Once patients book, their visits appear here with live status.",
                  iconName: "calendar",
                })
              : `<ul class="divide">${appointments
                  .map(
                    (appointment) => `<li class="apt-row">
                      <div class="row-top">
                        <div style="width:4.5rem;flex-shrink:0;font-size:0.875rem;font-weight:600">
                          ${escapeHtml(formatTime(appointment.starts_at))}
                        </div>
                        <div>
                          <p class="small strong">${escapeHtml(
                            (appointment.customer && appointment.customer.full_name) || "Patient",
                          )}</p>
                          <p class="xs muted">
                            ${escapeHtml((appointment.service && appointment.service.name) || "Service")} · 
                            ${escapeHtml((appointment.staff && appointment.staff.full_name) || "Staff")}${
                              appointment.customer && appointment.customer.phone
                                ? ` · ${escapeHtml(appointment.customer.phone)}`
                                : ""
                            }
                          </p>
                        </div>
                      </div>
                      ${appointmentStatusBadge(appointment.status)}
                    </li>`,
                  )
                  .join("")}</ul>`
        }
      </div>

      <div class="grid grid-2" style="margin-top:1.5rem">
        <div class="card">
          ${cardHead({
            title: "Low stock alerts",
            description: "Restock before you run out.",
            actions: `<a class="btn-link" href="/app/inventory" data-link>Inventory</a>`,
          })}
          ${
            loadError
              ? inlineLoader("Checking stock…")
              : data.lowStock.length === 0
                ? emptyState({
                    title: "Stock levels look healthy",
                    description: "No items below reorder level.",
                  })
                : `<ul class="divide">${data.lowStock
                    .slice(0, 5)
                    .map(
                      (item) => `<li class="between" style="padding:0.75rem 1.25rem">
                        <div class="grow">
                          <p class="small strong truncate">${escapeHtml(item.name)}</p>
                          <p class="xs muted">${item.quantity} in stock · reorder at ${item.reorder_level}</p>
                        </div>
                        ${badge(item.quantity === 0 ? "Out" : `+${item.units_needed}`, item.quantity === 0 ? "rose" : "amber")}
                      </li>`,
                    )
                    .join("")}</ul>`
          }
        </div>

        <div class="card">
          ${cardHead({ title: "Expiring soon", description: "Within the next 30 days." })}
          ${
            loadError
              ? inlineLoader("Checking expiry dates…")
              : data.expiring.length === 0
                ? emptyState({
                    title: "Nothing expiring soon",
                    description: "All batches are within date.",
                  })
                : `<ul class="divide">${data.expiring
                    .slice(0, 5)
                    .map(
                      (item) => `<li class="between" style="padding:0.75rem 1.25rem">
                        <div class="grow">
                          <p class="small strong truncate">${escapeHtml(item.name)}</p>
                          <p class="xs muted">Expires ${escapeHtml(
                            formatDate(item.expiry_date || item.created_at),
                          )} · ${item.quantity} units</p>
                        </div>
                        ${badge(`${item.days_until_expiry}d`, item.days_until_expiry <= 7 ? "rose" : "amber")}
                      </li>`,
                    )
                    .join("")}</ul>`
          }
        </div>
      </div>
    </div>
  </div>`;

  return {
    html,
    mount(root) {
      const reload = root.querySelector('[data-action="reload"]');
      if (reload) reload.addEventListener("click", () => window.dispatchEvent(new PopStateEvent("popstate")));
    },
  };
}

/* ========================================================================== */
/* Appointments                                                               */
/* ========================================================================== */

export async function renderAppointments() {
  const today = todayInClinicTimeZone();
  const filters = { fromDate: today, toDate: addDays(today, 7), status: "all", staffId: "all" };

  let staff = [];
  let appointments = [];
  let loadError = "";

  try {
    staff = await api.listPractitioners();
  } catch {
    staff = [];
  }

  const load = async () => {
    loadError = "";
    try {
      appointments = await api.listAppointments({
        from: getClinicDayRange(filters.fromDate).start,
        to: getClinicDayRange(filters.toDate).end,
        status: filters.status,
        staffId: filters.staffId,
      });
    } catch (error) {
      loadError = getErrorMessage(error, "Could not load the schedule");
      appointments = [];
    }
  };

  await load();

  const html = `<div class="stack">
    ${pageHeader({
      title: "Appointments",
      description: "Filter the schedule, confirm requests and record outcomes.",
    })}

    <div class="card">
      <div class="toolbar-grid four">
        <div>
          <label class="field-label" for="from-date">From</label>
          <input id="from-date" type="date" class="input" value="${filters.fromDate}" max="${filters.toDate}">
        </div>
        <div>
          <label class="field-label" for="to-date">To</label>
          <input id="to-date" type="date" class="input" value="${filters.toDate}" min="${filters.fromDate}">
        </div>
        ${selectField({
          id: "status-filter",
          label: "Status",
          value: filters.status,
          options: [
            { value: "all", label: "All statuses" },
            ...APPOINTMENT_STATUS_OPTIONS.map((option) => ({
              value: option,
              label: APPOINTMENT_STATUS_LABELS[option],
            })),
          ],
        })}
        ${selectField({
          id: "staff-filter",
          label: "Practitioner",
          value: filters.staffId,
          options: [
            { value: "all", label: "All practitioners" },
            ...staff.map((member) => ({ value: member.id, label: member.full_name })),
          ],
        })}
      </div>
      <div style="padding:0 1.25rem 1.25rem">
        <div class="between wrap">
          <p class="xs muted">Showing <span id="appointment-count">${
            appointments.length
          }</span> appointments · times in clinic timezone</p>
          ${button("Reset filters", { variant: "ghost", size: "sm", action: "reset" })}
        </div>
      </div>
    </div>

    <div id="appointments-list"></div>

    <p class="xs muted row">${icon("search", "icon-xs")}Every status change is recorded in the audit log.</p>
  </div>`;

  return {
    html,
    mount(root) {
      const list = root.querySelector("#appointments-list");
      const count = root.querySelector("#appointment-count");
      const fromInput = root.querySelector("#from-date");
      const toInput = root.querySelector("#to-date");
      const statusSelect = root.querySelector("#status-filter");
      const staffSelect = root.querySelector("#staff-filter");

      const renderGroups = () => {
        count.textContent = String(appointments.length);
        if (loadError) {
          list.innerHTML = `<div class="card pad between" style="flex-wrap:wrap">
            <p class="small" style="color:#e11d48">${escapeHtml(loadError)}</p>
            ${button("Try again", { size: "sm", variant: "outline", action: "reload" })}
          </div>`;
          const retry = list.querySelector('[data-action="reload"]');
          if (retry) retry.addEventListener("click", () => void refresh());
          return;
        }
        if (appointments.length === 0) {
          list.innerHTML = `<div class="card">${emptyState({
            title: "No appointments match these filters",
            description: "Try a wider date range or a different status.",
            iconName: "calendar",
          })}</div>`;
          return;
        }

        const groups = new Map();
        for (const appointment of appointments) {
          const day = appointment.starts_at.slice(0, 10);
          const existing = groups.get(day) || [];
          existing.push(appointment);
          groups.set(day, existing);
        }
        const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

        list.innerHTML = sorted
          .map(
            ([day, items]) => `<div class="card" style="margin-bottom:1.25rem">
              ${cardHead({
                title: formatDate(day),
                description: `${items.length} appointment${items.length === 1 ? "" : "s"}`,
              })}
              <div class="scroll-x"><table class="table">
                <thead><tr>
                  <th>Time</th><th>Patient</th><th>Service</th><th>Practitioner</th>
                  <th>Status</th><th>Update</th>
                </tr></thead>
                <tbody>${items
                  .map(
                    (appointment) => `<tr>
                      <td class="top nowrap strong">
                        ${escapeHtml(formatTime(appointment.starts_at))}
                        <span class="xs muted" style="display:block;font-weight:400">until ${escapeHtml(
                          formatTime(appointment.ends_at),
                        )}</span>
                      </td>
                      <td class="top">
                        <p class="small strong">${escapeHtml(
                          (appointment.customer && appointment.customer.full_name) || "Patient",
                        )}</p>
                        ${
                          appointment.customer && appointment.customer.phone
                            ? `<p class="xs muted">${escapeHtml(appointment.customer.phone)}</p>`
                            : ""
                        }
                        ${
                          appointment.notes
                            ? `<p class="xs muted mt-1" style="max-width:20rem">“${escapeHtml(
                                appointment.notes,
                              )}”</p>`
                            : ""
                        }
                      </td>
                      <td class="top">${escapeHtml(
                        (appointment.service && appointment.service.name) || "—",
                      )}</td>
                      <td class="top">${escapeHtml(
                        (appointment.staff && appointment.staff.full_name) || "—",
                      )}</td>
                      <td class="top">${appointmentStatusBadge(appointment.status)}</td>
                      <td class="top">
                        <label class="sr-only" for="status-${appointment.id}">Update status for ${
                          escapeHtml((appointment.customer && appointment.customer.full_name) || "appointment")
                        }</label>
                        <select class="select" id="status-${appointment.id}" data-status-id="${
                          appointment.id
                        }" style="min-height:32px;padding:0.25rem 2rem 0.25rem 0.625rem;font-size:0.75rem">
                          ${APPOINTMENT_STATUS_OPTIONS.map(
                            (option) =>
                              `<option value="${option}"${
                                option === appointment.status ? " selected" : ""
                              }>${APPOINTMENT_STATUS_LABELS[option]}</option>`,
                          ).join("")}
                        </select>
                      </td>
                    </tr>`,
                  )
                  .join("")}</tbody>
              </table></div>
            </div>`,
          )
          .join("");

        list.querySelectorAll("[data-status-id]").forEach((select) => {
          select.addEventListener("change", async () => {
            const appointment = appointments.find((item) => item.id === select.dataset.statusId);
            if (!appointment) return;
            select.disabled = true;
            try {
              await api.updateAppointmentStatus(appointment.id, select.value);
              toast.success(`Marked as ${APPOINTMENT_STATUS_LABELS[select.value].toLowerCase()}`);
              await refresh();
            } catch (error) {
              toast.error(getErrorMessage(error, "Could not update the appointment"));
              select.value = appointment.status;
              select.disabled = false;
            }
          });
        });
      };

      const refresh = async () => {
        list.innerHTML = `<div class="card">${inlineLoader("Loading schedule…")}</div>`;
        await load();
        renderGroups();
      };

      fromInput.addEventListener("change", () => {
        filters.fromDate = fromInput.value;
        fromInput.max = filters.toDate;
        toInput.min = filters.fromDate;
        void refresh();
      });
      toInput.addEventListener("change", () => {
        filters.toDate = toInput.value;
        void refresh();
      });
      statusSelect.addEventListener("change", () => {
        filters.status = statusSelect.value;
        void refresh();
      });
      staffSelect.addEventListener("change", () => {
        filters.staffId = staffSelect.value;
        void refresh();
      });
      root.querySelector('[data-action="reset"]').addEventListener("click", () => {
        filters.fromDate = today;
        filters.toDate = addDays(today, 7);
        filters.status = "all";
        filters.staffId = "all";
        fromInput.value = filters.fromDate;
        toInput.value = filters.toDate;
        statusSelect.value = "all";
        staffSelect.value = "all";
        void refresh();
      });

      renderGroups();
    },
  };
}

/* ========================================================================== */
/* Inventory                                                                  */
/* ========================================================================== */

const DEFAULT_ITEM = {
  name: "",
  sku: "",
  category: "",
  quantity: 0,
  reorderLevel: 5,
  unitPrice: 0,
  expiryDate: "",
  supplier: "",
};

function daysUntil(dateString) {
  if (!dateString) return null;
  const expiry = new Date(`${dateString}T23:59:59.000Z`).getTime();
  if (Number.isNaN(expiry)) return null;
  const today = new Date(`${todayInClinicTimeZone()}T00:00:00.000Z`).getTime();
  return Math.ceil((expiry - today) / 86400000);
}

function stockBadge(item) {
  if (item.quantity === 0) return badge("Out of stock", "rose");
  if (item.quantity <= item.reorder_level) return badge("Low stock", "amber");
  return badge("In stock", "emerald");
}

function friendlyInventoryError(message) {
  const lower = String(message).toLowerCase();
  if (lower.includes("duplicate key")) {
    return "An item with that SKU already exists. Use a unique SKU.";
  }
  if (lower.includes("insufficient stock")) {
    return "Not enough stock for that movement.";
  }
  return message;
}

const num = (value) => (value === "" || value === null ? NaN : Number(value));

export async function renderInventory() {
  const { user } = getAuth();
  let items = [];
  let loadError = "";
  const filters = { search: "", category: "all" };

  const load = async () => {
    loadError = "";
    try {
      items = await api.listInventory();
    } catch (error) {
      loadError = getErrorMessage(error, "Could not load inventory");
      items = [];
    }
  };

  await load();

  const html = `<div class="stack">
    ${pageHeader({
      title: "Inventory",
      description: "Track stock, reorder levels, expiry dates and every movement.",
      actions: `${button("CSV export", {
        variant: "outline",
        iconName: "download",
        action: "export",
      })}${button("Add item", { iconName: "plus", action: "create" })}`,
    })}

    <div class="card">
      <div class="toolbar">
        <div class="search-wrap">
          <label class="field-label" for="inventory-search">Search</label>
          ${icon("search", "icon-sm")}
          <input id="inventory-search" class="input" placeholder="Name, SKU, supplier…" value="">
        </div>
        <div style="width:14rem;max-width:100%">
          ${selectField({
            id: "category-filter",
            label: "Category",
            value: "all",
            options: [{ value: "all", label: "All categories" }],
          })}
        </div>
      </div>
    </div>

    <div class="card" id="inventory-card"></div>
  </div>`;

  return {
    html,
    mount(root) {
      const card = root.querySelector("#inventory-card");
      const search = root.querySelector("#inventory-search");
      const categorySelect = root.querySelector("#category-filter");
      const exportButton = root.querySelector('[data-action="export"]');
      const createButton = root.querySelector('[data-action="create"]');

      const categories = () => {
        const values = new Set();
        for (const item of items) if (item.category) values.add(item.category);
        return [...values].sort((a, b) => a.localeCompare(b));
      };

      const refreshCategoryOptions = () => {
        const current = categorySelect.value;
        categorySelect.innerHTML = `<option value="all">All categories</option>${categories()
          .map(
            (value) =>
              `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(
                value,
              )}</option>`,
          )
          .join("")}`;
      };

      const filtered = () => {
        const term = filters.search.trim().toLowerCase();
        return items.filter((item) => {
          const matchesTerm =
            term.length === 0 ||
            item.name.toLowerCase().includes(term) ||
            item.sku.toLowerCase().includes(term) ||
            (item.category || "").toLowerCase().includes(term) ||
            (item.supplier || "").toLowerCase().includes(term);
          const matchesCategory = filters.category === "all" || item.category === filters.category;
          return matchesTerm && matchesCategory;
        });
      };

      const renderTable = () => {
        refreshCategoryOptions();
        exportButton.disabled = filtered().length === 0;

        if (loadError) {
          card.innerHTML = `<div class="between" style="padding:1.25rem;flex-wrap:wrap">
            <p class="small" style="color:#e11d48">${escapeHtml(loadError)}</p>
            ${button("Try again", { variant: "outline", size: "sm", action: "reload" })}
          </div>`;
        } else if (filtered().length === 0) {
          card.innerHTML = emptyState({
            title: items.length === 0 ? "Your inventory is empty" : "No matching items",
            description:
              items.length === 0
                ? "Add your first item to start tracking stock levels."
                : "Adjust your search or category filter.",
            iconName: "box",
            action:
              items.length === 0
                ? button("Add item", { size: "sm", action: "create-empty" })
                : "",
          });
        } else {
          card.innerHTML = `<div class="scroll-x"><table class="table">
            <thead><tr>
              <th>Item</th><th>Category</th><th>Stock</th><th>Unit price</th><th>Expiry</th>
              <th class="text-right">Actions</th>
            </tr></thead>
            <tbody>${filtered()
              .map((item) => {
                const expiryDays = daysUntil(item.expiry_date);
                return `<tr>
                  <td>
                    <p class="strong">${escapeHtml(item.name)}</p>
                    <p class="xs muted">${escapeHtml(item.sku)}${
                      item.supplier ? ` · ${escapeHtml(item.supplier)}` : ""
                    }</p>
                  </td>
                  <td>${escapeHtml(item.category || "—")}</td>
                  <td>
                    <div class="stock-cell">
                      <span class="stock-count">${item.quantity}<span>/ reorder ${item.reorder_level}</span></span>
                      ${stockBadge(item)}
                    </div>
                  </td>
                  <td>${escapeHtml(formatCurrency(item.unit_price))}</td>
                  <td>${
                    item.expiry_date
                      ? `<div class="col" style="gap:0.25rem">
                          <span class="small">${escapeHtml(formatDate(item.expiry_date))}</span>
                          ${
                            expiryDays !== null && expiryDays <= 30
                              ? badge(
                                  expiryDays < 0 ? "Expired" : `${expiryDays}d left`,
                                  expiryDays <= 7 ? "rose" : "amber",
                                )
                              : ""
                          }
                        </div>`
                      : `<span class="muted">—</span>`
                  }</td>
                  <td><div class="actions">
                    ${button("Stock", { size: "sm", variant: "outline", action: "stock", attrs: `data-id="${item.id}"` })}
                    ${button("Edit", { size: "sm", variant: "ghost", action: "edit", attrs: `data-id="${item.id}"` })}
                    ${button(icon("trash", "icon-sm"), {
                      size: "sm",
                      variant: "ghost",
                      action: "delete",
                      attrs: `data-id="${item.id}" style="color:#e11d48" aria-label="Delete ${escapeHtml(
                        item.name,
                      )}"`,
                    })}
                  </div></td>
                </tr>`;
              })
              .join("")}</tbody>
          </table></div>`;
        }

        const reload = card.querySelector('[data-action="reload"]');
        if (reload) {
          reload.addEventListener("click", async () => {
            await load();
            renderTable();
          });
        }
        const emptyCreate = card.querySelector('[data-action="create-empty"]');
        if (emptyCreate) emptyCreate.addEventListener("click", () => openItemModal(null));
        card.querySelectorAll('[data-action="stock"]').forEach((el) => {
          el.addEventListener("click", () => {
            const item = items.find((row) => row.id === el.dataset.id);
            if (item) openMovementModal(item);
          });
        });
        card.querySelectorAll('[data-action="edit"]').forEach((el) => {
          el.addEventListener("click", () => {
            const item = items.find((row) => row.id === el.dataset.id);
            if (item) openItemModal(item);
          });
        });
        card.querySelectorAll('[data-action="delete"]').forEach((el) => {
          el.addEventListener("click", () => {
            const item = items.find((row) => row.id === el.dataset.id);
            if (item) openDeleteModal(item);
          });
        });
      };

      const itemForm = (item) => {
        const values = item
          ? {
              name: item.name,
              sku: item.sku,
              category: item.category || "",
              quantity: item.quantity,
              reorderLevel: item.reorder_level,
              unitPrice: item.unit_price,
              expiryDate: item.expiry_date || "",
              supplier: item.supplier || "",
            }
          : { ...DEFAULT_ITEM };

        return `<form id="inventory-form" class="inventory-form" novalidate>
          ${inputField({ id: "item-name", name: "name", label: "Item name", value: values.name })}
          ${inputField({
            id: "item-sku",
            name: "sku",
            label: "SKU",
            value: values.sku,
            hint: "Unique stock keeping unit.",
          })}
          ${inputField({
            id: "item-category",
            name: "category",
            label: "Category",
            value: values.category,
            placeholder: "Medicine, Supplies…",
          })}
          ${inputField({ id: "item-supplier", name: "supplier", label: "Supplier", value: values.supplier })}
          ${inputField({
            id: "item-quantity",
            name: "quantity",
            label: "Quantity",
            type: "number",
            value: values.quantity,
            attrs: 'min="0" step="1"',
          })}
          ${inputField({
            id: "item-reorder",
            name: "reorderLevel",
            label: "Reorder level",
            type: "number",
            value: values.reorderLevel,
            hint: "Alerts appear at or below this quantity.",
            attrs: 'min="0" step="1"',
          })}
          ${inputField({
            id: "item-price",
            name: "unitPrice",
            label: "Unit price",
            type: "number",
            value: values.unitPrice,
            attrs: 'min="0" step="0.01"',
          })}
          ${inputField({
            id: "item-expiry",
            name: "expiryDate",
            label: "Expiry date",
            type: "date",
            value: values.expiryDate,
          })}
        </form>`;
      };

      const openItemModal = (item) => {
        const close = openModal({
          title: item ? "Edit item" : "Add inventory item",
          description: "Quantities change through stock movements; initial stock is set here.",
          size: "lg",
          body: itemForm(item),
          footer: `${button("Cancel", {
            variant: "outline",
            action: "cancel",
          })}${button(item ? "Save changes" : "Add item", {
            type: "submit",
            attrs: 'form="inventory-form"',
            action: "save",
          })}`,
          onMount(panel) {
            const form = panel.querySelector("#inventory-form");
            panel.querySelector('[data-action="cancel"]').addEventListener("click", () => close());
            const save = panel.querySelector('[data-action="save"]');
            form.addEventListener("submit", async (event) => {
              event.preventDefault();
              const raw = Object.fromEntries(new FormData(form).entries());
              const values = {
                name: raw.name,
                sku: raw.sku,
                category: raw.category,
                quantity: num(raw.quantity),
                reorderLevel: num(raw.reorderLevel),
                unitPrice: num(raw.unitPrice),
                expiryDate: raw.expiryDate,
                supplier: raw.supplier,
              };
              const result = validateInventoryItem(values);
              showFieldErrors(form, result.errors);
              if (!result.valid) {
                toast.error(Object.values(result.errors)[0] || "Check the highlighted fields");
                return;
              }
              save.disabled = true;
              save.innerHTML = `${spinner("icon-sm", "Saving")}Saving…`;
              const payload = {
                name: values.name.trim(),
                sku: values.sku.trim().toUpperCase(),
                category: (values.category || "").trim() || null,
                quantity: values.quantity,
                reorder_level: values.reorderLevel,
                unit_price: values.unitPrice,
                expiry_date: (values.expiryDate || "").trim() || null,
                supplier: (values.supplier || "").trim() || null,
              };
              try {
                if (item) {
                  await api.updateInventoryItem(item.id, payload);
                  toast.success("Item updated");
                } else {
                  await api.insertInventoryItem(payload);
                  toast.success("Item added to inventory");
                }
                close();
                await load();
                renderTable();
              } catch (error) {
                toast.error(friendlyInventoryError(getErrorMessage(error, "Could not save the item")));
                save.disabled = false;
                save.textContent = item ? "Save changes" : "Add item";
              }
            });
          },
        });
      };

      const openMovementModal = (item) => {
        const close = openModal({
          title: "Record stock movement",
          description: `${item.name} · currently ${item.quantity} units`,
          size: "sm",
          body: `<form id="movement-form" novalidate>
            ${selectField({
              id: "movement-direction",
              name: "direction",
              label: "Direction",
              value: "in",
              options: [
                { value: "in", label: "Stock in (delivery / return)" },
                { value: "out", label: "Stock out (dispensed / used)" },
              ],
            })}
            <div class="mt-3">
              ${inputField({
                id: "movement-amount",
                name: "amount",
                label: "Quantity",
                type: "number",
                value: 1,
                attrs: 'min="1" step="1"',
              })}
            </div>
            <div class="mt-3">
              ${inputField({
                id: "movement-reason",
                name: "reason",
                label: "Reason",
                placeholder: "Delivery, dispensed to patient, expired…",
              })}
            </div>
            <p class="xs muted mt-3">
              Movements are logged and inventory quantity is updated automatically by the database.
            </p>
          </form>`,
          footer: `${button("Cancel", {
            variant: "outline",
            action: "cancel",
          })}${button("Save movement", {
            type: "submit",
            attrs: 'form="movement-form"',
            action: "save",
          })}`,
          onMount(panel) {
            const form = panel.querySelector("#movement-form");
            panel.querySelector('[data-action="cancel"]').addEventListener("click", () => close());
            const save = panel.querySelector('[data-action="save"]');
            form.addEventListener("submit", async (event) => {
              event.preventDefault();
              const raw = Object.fromEntries(new FormData(form).entries());
              const values = {
                direction: raw.direction,
                amount: num(raw.amount),
                reason: raw.reason,
              };
              const result = validateStockMovement(values);
              showFieldErrors(form, result.errors);
              if (!result.valid) {
                toast.error(Object.values(result.errors)[0] || "Check the highlighted fields");
                return;
              }
              save.disabled = true;
              save.innerHTML = `${spinner("icon-sm", "Saving")}Saving…`;
              try {
                await api.insertStockMovement({
                  itemId: item.id,
                  change: values.direction === "in" ? values.amount : -values.amount,
                  reason: values.reason.trim(),
                  createdBy: user ? user.id : null,
                });
                toast.success(
                  `Stock ${values.direction === "in" ? "added" : "removed"} for ${item.name}`,
                );
                close();
                await load();
                renderTable();
              } catch (error) {
                toast.error(
                  friendlyInventoryError(getErrorMessage(error, "Could not record the movement")),
                );
                save.disabled = false;
                save.textContent = "Save movement";
              }
            });
          },
        });
      };

      const openDeleteModal = (item) => {
        const close = openModal({
          title: "Delete inventory item?",
          description: "This also removes its stock movement history. This cannot be undone.",
          size: "sm",
          body: `<p class="small">You are about to delete <strong>${escapeHtml(
            item.name,
          )}</strong> (${escapeHtml(item.sku)}).</p>`,
          footer: `${button("Cancel", {
            variant: "outline",
            action: "cancel",
          })}${button("Delete item", { variant: "danger", action: "confirm" })}`,
          onMount(panel) {
            panel.querySelector('[data-action="cancel"]').addEventListener("click", () => close());
            const confirm = panel.querySelector('[data-action="confirm"]');
            confirm.addEventListener("click", async () => {
              confirm.disabled = true;
              confirm.innerHTML = `${spinner("icon-sm", "Deleting")}Deleting…`;
              try {
                await api.deleteInventoryItem(item.id);
                toast.success("Item deleted");
                close();
                await load();
                renderTable();
              } catch (error) {
                toast.error(getErrorMessage(error, "Could not delete the item"));
                confirm.disabled = false;
                confirm.textContent = "Delete item";
              }
            });
          },
        });
      };

      search.addEventListener("input", () => {
        filters.search = search.value;
        renderTable();
      });
      categorySelect.addEventListener("change", () => {
        filters.category = categorySelect.value;
        renderTable();
      });
      exportButton.addEventListener("click", () => {
        const columns = [
          { label: "Name", value: (row) => row.name },
          { label: "SKU", value: (row) => row.sku },
          { label: "Category", value: (row) => row.category },
          { label: "Quantity", value: (row) => row.quantity },
          { label: "Reorder level", value: (row) => row.reorder_level },
          { label: "Unit price", value: (row) => row.unit_price },
          { label: "Expiry date", value: (row) => row.expiry_date },
          { label: "Supplier", value: (row) => row.supplier },
        ];
        try {
          const rows = filtered();
          downloadCsv(`clinicflow-inventory-${todayInClinicTimeZone()}.csv`, columns, rows);
          toast.success(`Exported ${rows.length} items`);
        } catch (error) {
          toast.error(getErrorMessage(error, "Could not export inventory"));
        }
      });
      createButton.addEventListener("click", () => openItemModal(null));

      renderTable();
    },
  };
}

/* ========================================================================== */
/* Billing                                                                    */
/* ========================================================================== */

const DEFAULT_INVOICE = {
  customerId: "",
  appointmentId: "",
  taxRate: 0,
  items: [{ description: "", quantity: 1, unitPrice: 0 }],
};

export async function renderBilling() {
  let data = { invoices: [], customers: [], appointments: [] };
  let loadError = "";
  const filters = { status: "all", search: "" };

  const load = async () => {
    loadError = "";
    try {
      const [invoices, customers, appointments] = await Promise.all([
        api.listInvoices(),
        api.listCustomers(),
        api.listInvoiceableAppointments(),
      ]);
      data = { invoices, customers, appointments };
    } catch (error) {
      loadError = getErrorMessage(error, "Could not load billing data");
    }
  };

  await load();

  const html = `<div class="stack">
    ${pageHeader({
      title: "Billing",
      description: "Create invoices from visits, collect payment and issue PDF receipts.",
      actions: button("New invoice", { iconName: "plus", action: "create" }),
    })}

    <div class="card">
      <div class="toolbar-grid" style="align-items:end">
        <div>
          <label class="field-label" for="invoice-search">Search</label>
          <input id="invoice-search" class="input" placeholder="Invoice number or customer…">
        </div>
        ${selectField({
          id: "invoice-status-filter",
          label: "Status",
          value: "all",
          options: [
            { value: "all", label: "All invoices" },
            { value: "unpaid", label: "Unpaid" },
            { value: "paid", label: "Paid" },
            { value: "void", label: "Void" },
          ],
        })}
      </div>
    </div>

    <div class="card">
      <div id="billing-head"></div>
      <div id="billing-table"></div>
    </div>
  </div>`;

  return {
    html,
    mount(root) {
      const head = root.querySelector("#billing-head");
      const table = root.querySelector("#billing-table");
      const search = root.querySelector("#invoice-search");
      const statusFilter = root.querySelector("#invoice-status-filter");
      const createButton = root.querySelector('[data-action="create"]');

      const filteredInvoices = () => {
        const term = filters.search.trim().toLowerCase();
        return data.invoices.filter((invoice) => {
          const matchesStatus = filters.status === "all" || invoice.status === filters.status;
          const matchesTerm =
            term.length === 0 ||
            formatInvoiceNumber(invoice.id).toLowerCase().includes(term) ||
            ((invoice.customer && invoice.customer.full_name) || "").toLowerCase().includes(term);
          return matchesStatus && matchesTerm;
        });
      };

      const downloadPdf = async (invoice) => {
        try {
          const { downloadInvoicePdf } = await import("../pdf.js");
          downloadInvoicePdf({
            invoice,
            items: invoice.invoice_items || [],
            customer: invoice.customer,
          });
          toast.success("Invoice PDF downloaded");
        } catch (error) {
          toast.error(getErrorMessage(error, "Could not generate the PDF"));
        }
      };

      const markPaid = async (invoice) => {
        try {
          await api.markInvoicePaid(invoice.id);
          toast.success(`${formatInvoiceNumber(invoice.id)} marked as paid`);
          await load();
          renderTable();
        } catch (error) {
          toast.error(getErrorMessage(error, "Could not update the invoice"));
        }
      };

      const renderTable = () => {
        const rows = filteredInvoices();
        const collected = rows
          .filter((invoice) => invoice.status === "paid")
          .reduce((sum, invoice) => sum + Number(invoice.total), 0);

        head.innerHTML = cardHead({
          title: "Invoices",
          description: `${rows.length} shown · ${formatCurrency(collected)} collected`,
        });

        if (loadError) {
          table.innerHTML = `<div class="between" style="padding:1.25rem;flex-wrap:wrap">
            <p class="small" style="color:#e11d48">${escapeHtml(loadError)}</p>
            ${button("Try again", { variant: "outline", size: "sm", action: "reload" })}
          </div>`;
        } else if (rows.length === 0) {
          table.innerHTML = emptyState({
            title: "No invoices here",
            description: "Create an invoice after a completed visit, or adjust your filters.",
            iconName: "receipt",
            action: button("Create invoice", { size: "sm", action: "create-empty" }),
          });
        } else {
          table.innerHTML = `<div class="scroll-x"><table class="table">
            <thead><tr>
              <th>Invoice</th><th>Customer</th><th>Issued</th><th>Total</th><th>Status</th>
              <th class="text-right">Actions</th>
            </tr></thead>
            <tbody>${rows
              .map((invoice) => {
                const items = invoice.invoice_items || [];
                return `<tr>
                  <td class="nowrap">
                    <p class="strong">${escapeHtml(formatInvoiceNumber(invoice.id))}</p>
                    <p class="xs muted">${items.length} line item${items.length === 1 ? "" : "s"}</p>
                  </td>
                  <td>${escapeHtml((invoice.customer && invoice.customer.full_name) || "—")}</td>
                  <td>${escapeHtml(formatDate(invoice.created_at))}</td>
                  <td class="strong">${escapeHtml(formatCurrency(invoice.total))}</td>
                  <td>${invoiceStatusBadge(invoice.status)}</td>
                  <td><div class="actions">
                    ${
                      invoice.status === "unpaid"
                        ? button("Mark paid", {
                            size: "sm",
                            variant: "outline",
                            action: "pay",
                            attrs: `data-id="${invoice.id}"`,
                          })
                        : ""
                    }
                    ${button(`${icon("download", "icon-sm")}PDF`, {
                      size: "sm",
                      variant: "ghost",
                      action: "pdf",
                      attrs: `data-id="${invoice.id}"`,
                    })}
                  </div></td>
                </tr>`;
              })
              .join("")}</tbody>
          </table></div>`;
        }

        const reload = table.querySelector('[data-action="reload"]');
        if (reload) {
          reload.addEventListener("click", async () => {
            await load();
            renderTable();
          });
        }
        const emptyCreate = table.querySelector('[data-action="create-empty"]');
        if (emptyCreate) emptyCreate.addEventListener("click", openCreate);
        table.querySelectorAll('[data-action="pay"]').forEach((el) => {
          el.addEventListener("click", () => {
            const invoice = data.invoices.find((item) => item.id === el.dataset.id);
            if (invoice) void markPaid(invoice);
          });
        });
        table.querySelectorAll('[data-action="pdf"]').forEach((el) => {
          el.addEventListener("click", () => {
            const invoice = data.invoices.find((item) => item.id === el.dataset.id);
            if (invoice) void downloadPdf(invoice);
          });
        });
      };

      const lineHtml = (line, index) => `<div class="line-item" data-line="${index}">
        ${inputField({
          id: `line-description-${index}`,
          name: `description-${index}`,
          label: index === 0 ? "Description" : "",
          placeholder: "Consultation, medication…",
          value: line.description,
          attrs: `aria-label="Description for line ${index + 1}"`,
        })}
        ${inputField({
          id: `line-quantity-${index}`,
          name: `quantity-${index}`,
          label: index === 0 ? "Qty" : "",
          type: "number",
          value: line.quantity,
          attrs: `min="1" step="1" aria-label="Quantity for line ${index + 1}"`,
        })}
        ${inputField({
          id: `line-price-${index}`,
          name: `unitPrice-${index}`,
          label: index === 0 ? "Unit price" : "",
          type: "number",
          value: line.unitPrice,
          attrs: `min="0" step="0.01" aria-label="Unit price for line ${index + 1}"`,
        })}
        <div class="remove-cell">
          ${button(icon("trash", "icon-sm"), {
            size: "sm",
            variant: "ghost",
            action: "remove-line",
            attrs: `data-index="${index}" aria-label="Remove line ${index + 1}"`,
          })}
        </div>
      </div>`;

      const openCreate = () => {
        const state = {
          customerId: "",
          appointmentId: "",
          taxRate: 0,
          items: [{ description: "", quantity: 1, unitPrice: 0 }],
        };

        const close = openModal({
          title: "Create invoice",
          description: "Link an appointment for convenience, or invoice a customer directly.",
          size: "xl",
          body: `<form id="invoice-form" novalidate>
            <div class="form-grid two">
              ${selectField({
                id: "invoice-appointment",
                label: "Appointment (optional)",
                value: "",
                options: [
                  { value: "", label: "No appointment" },
                  ...data.appointments.map((appointment) => ({
                    value: appointment.id,
                    label: `${formatDate(appointment.starts_at)} · ${formatTime(
                      appointment.starts_at,
                    )} · ${(appointment.customer && appointment.customer.full_name) || "Customer"}`,
                  })),
                ],
              })}
              ${selectField({
                id: "invoice-customer",
                name: "customerId",
                label: "Customer",
                value: "",
                options: [
                  { value: "", label: "Select a customer" },
                  ...data.customers.map((customer) => ({
                    value: customer.id,
                    label: customer.full_name,
                  })),
                ],
              })}
            </div>

            <div class="mt-5">
              <div class="between">
                <p class="small strong">Line items</p>
                ${button("Add line", {
                  size: "sm",
                  variant: "outline",
                  iconName: "plus",
                  action: "add-line",
                })}
              </div>
              <p class="field-error" data-error-for="items" role="alert"></p>
              <div id="invoice-lines" class="mt-3 col" style="gap:0.75rem"></div>
            </div>

            <div class="between wrap mt-5" style="align-items:flex-end">
              <div style="width:100%;max-width:180px">
                ${inputField({
                  id: "invoice-tax",
                  name: "taxRate",
                  label: "Tax rate (%)",
                  type: "number",
                  value: 0,
                  attrs: 'min="0" max="100" step="0.01"',
                })}
              </div>
              <dl class="totals" id="invoice-totals"></dl>
            </div>
          </form>`,
          footer: `${button("Cancel", {
            variant: "outline",
            action: "cancel",
          })}${button("Create invoice", {
            type: "submit",
            attrs: 'form="invoice-form"',
            action: "save",
          })}`,
          onMount(panel) {
            const form = panel.querySelector("#invoice-form");
            const linesRoot = panel.querySelector("#invoice-lines");
            const totalsRoot = panel.querySelector("#invoice-totals");
            const appointmentSelect = panel.querySelector("#invoice-appointment");
            const customerSelect = panel.querySelector("#invoice-customer");
            const taxInput = panel.querySelector("#invoice-tax");
            const save = panel.querySelector('[data-action="save"]');

            const renderLines = () => {
              linesRoot.innerHTML = state.items.map((line, index) => lineHtml(line, index)).join("");
              linesRoot.querySelectorAll("[data-line]").forEach((lineEl) => {
                const index = Number(lineEl.dataset.line);
                const description = lineEl.querySelector(`#line-description-${index}`);
                const quantity = lineEl.querySelector(`#line-quantity-${index}`);
                const price = lineEl.querySelector(`#line-price-${index}`);
                description.addEventListener("input", () => {
                  state.items[index].description = description.value;
                });
                quantity.addEventListener("input", () => {
                  state.items[index].quantity = num(quantity.value);
                  renderTotals();
                });
                price.addEventListener("input", () => {
                  state.items[index].unitPrice = num(price.value);
                  renderTotals();
                });
              });
              linesRoot.querySelectorAll('[data-action="remove-line"]').forEach((el) => {
                if (state.items.length === 1) {
                  el.disabled = true;
                  return;
                }
                el.addEventListener("click", () => {
                  state.items.splice(Number(el.dataset.index), 1);
                  renderLines();
                  renderTotals();
                });
              });
              renderTotals();
            };

            const renderTotals = () => {
              const totals = computeInvoiceTotals(state.items, state.taxRate);
              totalsRoot.innerHTML = `
                <div><dt class="muted">Subtotal</dt><dd>${escapeHtml(
                  formatCurrency(totals.subtotal),
                )}</dd></div>
                <div><dt class="muted">Tax</dt><dd>${escapeHtml(formatCurrency(totals.tax))}</dd></div>
                <div class="grand"><dt>Total</dt><dd>${escapeHtml(formatCurrency(totals.total))}</dd></div>`;
              save.textContent = `Create invoice · ${formatCurrency(totals.total)}`;
            };

            panel.querySelector('[data-action="add-line"]').addEventListener("click", () => {
              state.items.push({ description: "", quantity: 1, unitPrice: 0 });
              renderLines();
            });
            panel.querySelector('[data-action="cancel"]').addEventListener("click", () => close());

            appointmentSelect.addEventListener("change", () => {
              state.appointmentId = appointmentSelect.value;
              const appointment = data.appointments.find(
                (item) => item.id === state.appointmentId,
              );
              if (!appointment) return;
              state.customerId = appointment.customer_id;
              customerSelect.value = appointment.customer_id;
              if (appointment.service) {
                state.items = [
                  {
                    description: appointment.service.name,
                    quantity: 1,
                    unitPrice: appointment.service.price,
                  },
                ];
                renderLines();
              }
            });

            customerSelect.addEventListener("change", () => {
              state.customerId = customerSelect.value;
            });

            taxInput.addEventListener("input", () => {
              state.taxRate = num(taxInput.value);
              renderTotals();
            });

            form.addEventListener("submit", async (event) => {
              event.preventDefault();
              state.customerId = customerSelect.value;
              const result = validateInvoice(state);
              showFieldErrors(form, result.errors);
              (result.itemErrors || []).forEach((lineErrors, index) => {
                Object.entries(lineErrors).forEach(([field, message]) => {
                  const input = form.querySelector(`#line-${field === "unitPrice" ? "price" : field === "quantity" ? "quantity" : "description"}-${index}`);
                  if (input) input.setAttribute("aria-invalid", "true");
                  if (input) {
                    const fieldEl = input.closest(".field");
                    let slot = fieldEl && fieldEl.querySelector(`[data-error-for="line-${index}-${field}"]`);
                    if (!slot && fieldEl) {
                      slot = document.createElement("p");
                      slot.className = "field-error";
                      slot.setAttribute("data-error-for", `line-${index}-${field}`);
                      fieldEl.appendChild(slot);
                    }
                    if (slot) slot.textContent = message;
                  }
                });
              });
              if (!result.valid) {
                const firstLine = (result.itemErrors || []).find(
                  (line) => Object.keys(line).length > 0,
                );
                toast.error(
                  firstLine
                    ? Object.values(firstLine)[0]
                    : Object.values(result.errors).find(Boolean) || "Check the highlighted fields",
                );
                return;
              }

              save.disabled = true;
              const previous = save.textContent;
              save.innerHTML = `${spinner("icon-sm", "Creating")}Creating…`;
              try {
                await api.createInvoice({
                  customerId: state.customerId,
                  appointmentId: state.appointmentId,
                  taxRate: state.taxRate,
                  items: state.items,
                });
                toast.success("Invoice created");
                close();
                await load();
                renderTable();
              } catch (error) {
                toast.error(getErrorMessage(error, "Could not create the invoice"));
                save.disabled = false;
                save.textContent = previous;
              }
            });

            renderLines();
          },
        });
      };

      search.addEventListener("input", () => {
        filters.search = search.value;
        renderTable();
      });
      statusFilter.addEventListener("change", () => {
        filters.status = statusFilter.value;
        renderTable();
      });
      createButton.addEventListener("click", openCreate);

      renderTable();
    },
  };
}

