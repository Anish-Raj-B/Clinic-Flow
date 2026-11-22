/**
 * Owner pages: services, staff & roles, analytics, audit logs.
 */

import {
  badge,
  button,
  cardHead,
  emptyState,
  inlineLoader,
  inputField,
  openModal,
  pageHeader,
  roleBadge,
  selectField,
  showFieldErrors,
  spinner,
  statCard,
  textareaField,
} from "../components.js";
import { icon } from "../icons.js";
import * as api from "../api.js";
import { barChart, lineChart, mountCharts } from "../charts.js";
import { getAuth, toast } from "../store.js";
import { validateAvailability, validateService } from "../validation.js";
import {
  ROLE_LABELS,
  WEEKDAY_LABELS,
  addDays,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatDateTime,
  getErrorMessage,
  initials,
  todayInClinicTimeZone,
} from "../utils.js";

const num = (value) => (value === "" || value === null ? NaN : Number(value));

/* ========================================================================== */
/* Services                                                                   */
/* ========================================================================== */

const DEFAULT_SERVICE = {
  name: "",
  description: "",
  durationMinutes: 30,
  price: 0,
  active: true,
};

function friendlyServiceError(message) {
  if (String(message).toLowerCase().includes("foreign key")) {
    return "This service is linked to existing appointments. Deactivate it instead of deleting.";
  }
  return message;
}

export async function renderServices() {
  let services = [];
  let loadError = "";

  const load = async () => {
    loadError = "";
    try {
      services = await api.listServicesForAdmin();
    } catch (error) {
      loadError = getErrorMessage(error, "Could not load services");
      services = [];
    }
  };

  await load();

  const html = `<div class="stack">
    ${pageHeader({
      title: "Services",
      description: "Define what patients can book, how long it takes and what it costs.",
      actions: button("New service", { iconName: "plus", action: "create" }),
    })}
    <div class="card" id="services-card"></div>
  </div>`;

  return {
    html,
    mount(root) {
      const card = root.querySelector("#services-card");
      const createButton = root.querySelector('[data-action="create"]');

      const renderTable = () => {
        if (loadError) {
          card.innerHTML = `<div class="between" style="padding:1.25rem;flex-wrap:wrap">
            <p class="small" style="color:#e11d48">${escapeHtml(loadError)}</p>
            ${button("Try again", { variant: "outline", size: "sm", action: "reload" })}
          </div>`;
        } else if (services.length === 0) {
          card.innerHTML = emptyState({
            title: "No services yet",
            description: "Create your first bookable service to open the booking flow.",
            iconName: "settings",
            action: button("New service", { size: "sm", action: "create-empty" }),
          });
        } else {
          card.innerHTML = `<div class="scroll-x"><table class="table">
            <thead><tr>
              <th>Service</th><th>Duration</th><th>Price</th><th>Status</th>
              <th class="text-right">Actions</th>
            </tr></thead>
            <tbody>${services
              .map(
                (service) => `<tr>
                  <td>
                    <p class="strong">${escapeHtml(service.name)}</p>
                    ${
                      service.description
                        ? `<p class="xs muted mt-1" style="max-width:28rem">${escapeHtml(
                            service.description,
                          )}</p>`
                        : ""
                    }
                  </td>
                  <td class="nowrap">
                    <span class="row gap-1">${icon("clock", "icon-xs")}${
                      service.duration_minutes
                    } min</span>
                  </td>
                  <td class="strong">${escapeHtml(formatCurrency(service.price))}</td>
                  <td>${badge(service.active ? "Bookable" : "Inactive", service.active ? "emerald" : "slate")}</td>
                  <td><div class="actions">
                    ${button(service.active ? "Deactivate" : "Activate", {
                      size: "sm",
                      variant: "outline",
                      action: "toggle",
                      attrs: `data-id="${service.id}"`,
                    })}
                    ${button("Edit", {
                      size: "sm",
                      variant: "ghost",
                      action: "edit",
                      attrs: `data-id="${service.id}"`,
                    })}
                    ${button("Delete", {
                      size: "sm",
                      variant: "ghost",
                      action: "delete",
                      attrs: `data-id="${service.id}" style="color:#e11d48"`,
                    })}
                  </div></td>
                </tr>`,
              )
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
        if (emptyCreate) emptyCreate.addEventListener("click", () => openServiceModal(null));
        card.querySelectorAll('[data-action="toggle"]').forEach((el) => {
          el.addEventListener("click", async () => {
            const service = services.find((row) => row.id === el.dataset.id);
            if (!service) return;
            el.disabled = true;
            try {
              await api.toggleServiceActive(service.id, !service.active);
              toast.success(service.active ? "Service deactivated" : "Service activated");
              await load();
              renderTable();
            } catch (error) {
              toast.error(getErrorMessage(error, "Could not update the service"));
              el.disabled = false;
            }
          });
        });
        card.querySelectorAll('[data-action="edit"]').forEach((el) => {
          el.addEventListener("click", () => {
            const service = services.find((row) => row.id === el.dataset.id);
            if (service) openServiceModal(service);
          });
        });
        card.querySelectorAll('[data-action="delete"]').forEach((el) => {
          el.addEventListener("click", () => {
            const service = services.find((row) => row.id === el.dataset.id);
            if (service) openDeleteModal(service);
          });
        });
      };

      const openServiceModal = (service) => {
        const values = service
          ? {
              name: service.name,
              description: service.description || "",
              durationMinutes: service.duration_minutes,
              price: service.price,
              active: service.active,
            }
          : { ...DEFAULT_SERVICE };

        const close = openModal({
          title: service ? "Edit service" : "New service",
          description: "Duration drives slot generation; price is used for invoicing.",
          body: `<form id="service-form" novalidate>
            ${inputField({
              id: "service-name",
              name: "name",
              label: "Service name",
              value: values.name,
              placeholder: "General consultation",
            })}
            <div class="mt-3">
              ${textareaField({
                id: "service-description",
                name: "description",
                label: "Description (optional)",
                value: values.description,
                placeholder: "What patients can expect…",
              })}
            </div>
            <div class="form-grid two mt-3">
              ${inputField({
                id: "service-duration",
                name: "durationMinutes",
                label: "Duration (minutes)",
                type: "number",
                value: values.durationMinutes,
                attrs: 'min="5" max="480" step="5"',
              })}
              ${inputField({
                id: "service-price",
                name: "price",
                label: "Price",
                type: "number",
                value: values.price,
                attrs: 'min="0" step="0.01"',
              })}
            </div>
            <label class="checkbox-label mt-3">
              <input type="checkbox" name="active" ${values.active ? "checked" : ""}>
              Active and bookable by customers
            </label>
          </form>`,
          footer: `${button("Cancel", {
            variant: "outline",
            action: "cancel",
          })}${button(service ? "Save changes" : "Create service", {
            type: "submit",
            attrs: 'form="service-form"',
            action: "save",
          })}`,
          onMount(panel) {
            const form = panel.querySelector("#service-form");
            panel.querySelector('[data-action="cancel"]').addEventListener("click", () => close());
            const save = panel.querySelector('[data-action="save"]');
            form.addEventListener("submit", async (event) => {
              event.preventDefault();
              const raw = Object.fromEntries(new FormData(form).entries());
              const payloadValues = {
                name: raw.name,
                description: raw.description,
                durationMinutes: num(raw.durationMinutes),
                price: num(raw.price),
                active: form.querySelector('[name="active"]').checked,
              };
              const result = validateService(payloadValues);
              showFieldErrors(form, result.errors);
              if (!result.valid) {
                toast.error(Object.values(result.errors)[0] || "Check the highlighted fields");
                return;
              }
              const payload = {
                name: payloadValues.name.trim(),
                description: (payloadValues.description || "").trim() || null,
                duration_minutes: payloadValues.durationMinutes,
                price: payloadValues.price,
                active: payloadValues.active,
              };
              save.disabled = true;
              save.innerHTML = `${spinner("icon-sm", "Saving")}Saving…`;
              try {
                await api.saveService(payload, service ? service.id : null);
                toast.success(service ? "Service updated" : "Service created");
                close();
                await load();
                renderTable();
              } catch (error) {
                toast.error(friendlyServiceError(getErrorMessage(error, "Could not save the service")));
                save.disabled = false;
                save.textContent = service ? "Save changes" : "Create service";
              }
            });
          },
        });
      };

      const openDeleteModal = (service) => {
        const close = openModal({
          title: "Delete service?",
          description: "Services used by past appointments cannot be deleted - deactivate them instead.",
          size: "sm",
          body: `<p class="small">Delete <strong>${escapeHtml(
            service.name,
          )}</strong>? This cannot be undone.</p>`,
          footer: `${button("Cancel", {
            variant: "outline",
            action: "cancel",
          })}${button("Delete service", { variant: "danger", action: "confirm" })}`,
          onMount(panel) {
            panel.querySelector('[data-action="cancel"]').addEventListener("click", () => close());
            const confirm = panel.querySelector('[data-action="confirm"]');
            confirm.addEventListener("click", async () => {
              confirm.disabled = true;
              confirm.innerHTML = `${spinner("icon-sm", "Deleting")}Deleting…`;
              try {
                await api.deleteService(service.id);
                toast.success("Service deleted");
                close();
                await load();
                renderTable();
              } catch (error) {
                toast.error(
                  friendlyServiceError(getErrorMessage(error, "Could not delete the service")),
                );
                close();
              }
            });
          },
        });
      };

      createButton.addEventListener("click", () => openServiceModal(null));
      renderTable();
    },
  };
}

/* ========================================================================== */
/* Staff & roles                                                              */
/* ========================================================================== */

const ROLES = ["customer", "staff", "owner"];

function friendlyRoleError(message) {
  const lower = String(message).toLowerCase();
  if (lower.includes("your own role")) {
    return "You cannot change your own role. Ask another owner to do it.";
  }
  if (lower.includes("only owners")) {
    return "Only owners can change roles.";
  }
  return message;
}

export async function renderStaff() {
  const { user } = getAuth();
  let profiles = [];
  let availability = [];
  let loadError = "";

  const load = async () => {
    loadError = "";
    try {
      [profiles, availability] = await Promise.all([api.listProfiles(), api.listAvailability()]);
    } catch (error) {
      loadError = getErrorMessage(error, "Could not load people");
    }
  };

  await load();

  const html = `<div class="stack">
    ${pageHeader({
      title: "Staff & roles",
      description: "Promote team members and maintain the weekly availability used for booking.",
    })}

    <div class="card pad">
      <label class="field-label" for="staff-search">Search people</label>
      <input id="staff-search" class="input" placeholder="Name, phone or role…">
      <p class="xs muted row-top mt-3">
        ${icon("shield", "icon-xs")}
        <span>New signups are always customers. Owners can promote to staff or owner; nobody can
        change their own role, and all role changes are audited.</span>
      </p>
    </div>

    <div class="card">
      <div id="people-head"></div>
      <div id="people-table"></div>
    </div>
  </div>`;

  return {
    html,
    mount(root) {
      const head = root.querySelector("#people-head");
      const table = root.querySelector("#people-table");
      const search = root.querySelector("#staff-search");
      let term = "";

      const filteredProfiles = () => {
        const value = term.trim().toLowerCase();
        if (!value) return profiles;
        return profiles.filter(
          (profile) =>
            profile.full_name.toLowerCase().includes(value) ||
            (profile.phone || "").toLowerCase().includes(value) ||
            profile.role.toLowerCase().includes(value),
        );
      };

      const renderTable = () => {
        const rows = filteredProfiles();
        head.innerHTML = cardHead({
          title: "People",
          description: `${rows.length} accounts`,
        });

        if (loadError) {
          table.innerHTML = `<div class="between" style="padding:1.25rem;flex-wrap:wrap">
            <p class="small" style="color:#e11d48">${escapeHtml(loadError)}</p>
            ${button("Try again", { variant: "outline", size: "sm", action: "reload" })}
          </div>`;
        } else if (rows.length === 0) {
          table.innerHTML = emptyState({
            title: "No accounts found",
            description: "Adjust the search to find a team member.",
            iconName: "users",
          });
        } else {
          table.innerHTML = `<div class="scroll-x"><table class="table">
            <thead><tr>
              <th>Person</th><th>Contact</th><th>Joined</th><th>Role</th>
              <th class="text-right">Availability</th>
            </tr></thead>
            <tbody>${rows
              .map((profile) => {
                const isSelf = user && profile.id === user.id;
                const blocks = availability.filter((block) => block.staff_id === profile.id).length;
                return `<tr>
                  <td>
                    <div class="person-cell">
                      <span class="avatar" style="background:var(--brand-100);color:var(--brand-800)">${escapeHtml(
                        initials(profile.full_name),
                      )}</span>
                      <div>
                        <p class="strong">${escapeHtml(profile.full_name)}${
                          isSelf ? '<span class="xs muted"> (you)</span>' : ""
                        }</p>
                        <div class="mt-1">${roleBadge(profile.role)}</div>
                      </div>
                    </div>
                  </td>
                  <td>${escapeHtml(profile.phone || "—")}</td>
                  <td>${escapeHtml(formatDate(profile.created_at))}</td>
                  <td>
                    <label class="sr-only" for="role-${profile.id}">Role for ${escapeHtml(
                      profile.full_name,
                    )}</label>
                    <select class="select" id="role-${profile.id}" data-role-id="${profile.id}"
                      style="min-height:32px;padding:0.25rem 2rem 0.25rem 0.625rem;font-size:0.75rem"
                      ${isSelf ? "disabled" : ""}>
                      ${ROLES.map(
                        (role) =>
                          `<option value="${role}"${
                            role === profile.role ? " selected" : ""
                          }>${ROLE_LABELS[role]}</option>`,
                      ).join("")}
                    </select>
                  </td>
                  <td class="text-right">
                    <div class="col" style="align-items:flex-end;gap:0.25rem">
                      ${badge(
                        `${blocks} block${blocks === 1 ? "" : "s"}`,
                        blocks > 0 ? "brand" : "slate",
                      )}
                      ${button("Manage hours", {
                        size: "sm",
                        variant: "outline",
                        action: "hours",
                        attrs: `data-id="${profile.id}"${profile.role === "customer" ? " disabled" : ""}`,
                      })}
                    </div>
                  </td>
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
        table.querySelectorAll("[data-role-id]").forEach((select) => {
          select.addEventListener("change", async () => {
            const profile = profiles.find((row) => row.id === select.dataset.roleId);
            if (!profile || profile.role === select.value) return;
            select.disabled = true;
            try {
              await api.updateProfileRole(profile.id, select.value);
              toast.success(`${profile.full_name} is now ${ROLE_LABELS[select.value].toLowerCase()}`);
              await load();
              renderTable();
            } catch (error) {
              toast.error(friendlyRoleError(getErrorMessage(error, "Could not change the role")));
              select.value = profile.role;
              select.disabled = false;
            }
          });
        });
        table.querySelectorAll('[data-action="hours"]').forEach((el) => {
          el.addEventListener("click", () => {
            const profile = profiles.find((row) => row.id === el.dataset.id);
            if (profile) openAvailabilityModal(profile);
          });
        });
      };

      const openAvailabilityModal = (profile) => {
        const blocks = () =>
          availability
            .filter((block) => block.staff_id === profile.id)
            .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));

        const close = openModal({
          title: `Availability · ${profile.full_name}`,
          description: "Weekly recurring hours used to generate bookable time slots.",
          size: "lg",
          body: `<div class="stack" style="gap:1.25rem">
            <div>
              <h3 class="small strong">Current blocks</h3>
              <div id="availability-list"></div>
            </div>
            <form id="availability-form" novalidate>
              <h3 class="small strong">Add a block</h3>
              <div class="availability-form">
                ${selectField({
                  id: "availability-weekday",
                  name: "weekday",
                  label: "Weekday",
                  value: 1,
                  options: WEEKDAY_LABELS.map((label, index) => ({
                    value: index,
                    label,
                  })),
                })}
                ${inputField({
                  id: "availability-start",
                  name: "startTime",
                  label: "Start",
                  type: "time",
                  value: "09:00",
                })}
                ${inputField({
                  id: "availability-end",
                  name: "endTime",
                  label: "End",
                  type: "time",
                  value: "17:00",
                })}
                ${button("Add", { type: "submit", iconName: "plus", attrs: 'id="availability-submit"' })}
              </div>
            </form>
          </div>`,
          footer: button("Done", { variant: "outline", action: "done" }),
          onMount(panel) {
            const listRoot = panel.querySelector("#availability-list");
            const form = panel.querySelector("#availability-form");
            const submit = panel.querySelector("#availability-submit");
            panel.querySelector('[data-action="done"]').addEventListener("click", () => close());

            const renderBlocks = () => {
              const rows = blocks();
              if (rows.length === 0) {
                listRoot.innerHTML = `<p class="info-box mt-2">
                  No availability yet. This practitioner cannot be booked until a block is added.
                </p>`;
                return;
              }
              listRoot.innerHTML = `<ul class="availability-list">${rows
                .map(
                  (block) => `<li>
                    <span class="strong">${escapeHtml(WEEKDAY_LABELS[block.weekday] || "Unknown")}</span>
                    <span class="muted">${block.start_time.slice(0, 5)} – ${block.end_time.slice(0, 5)}</span>
                    ${button(icon("trash", "icon-sm"), {
                      size: "sm",
                      variant: "ghost",
                      action: "remove",
                      attrs: `data-block="${block.id}" style="color:#e11d48" aria-label="Remove ${escapeHtml(
                        WEEKDAY_LABELS[block.weekday],
                      )} block"`,
                    })}
                  </li>`,
                )
                .join("")}</ul>`;
              listRoot.querySelectorAll('[data-action="remove"]').forEach((el) => {
                el.addEventListener("click", async () => {
                  el.disabled = true;
                  try {
                    await api.removeAvailability(el.dataset.block);
                    toast.success("Availability block removed");
                    await load();
                    renderBlocks();
                    renderTable();
                  } catch (error) {
                    toast.error(getErrorMessage(error, "Could not remove availability"));
                    el.disabled = false;
                  }
                });
              });
            };

            form.addEventListener("submit", async (event) => {
              event.preventDefault();
              const raw = Object.fromEntries(new FormData(form).entries());
              const values = {
                weekday: num(raw.weekday),
                startTime: raw.startTime,
                endTime: raw.endTime,
              };
              const result = validateAvailability(values);
              showFieldErrors(form, result.errors);
              if (!result.valid) {
                toast.error(Object.values(result.errors)[0] || "Check the highlighted fields");
                return;
              }
              submit.disabled = true;
              submit.innerHTML = `${spinner("icon-sm", "Saving")}Adding…`;
              try {
                await api.addAvailability({
                  staffId: profile.id,
                  weekday: values.weekday,
                  startTime: values.startTime,
                  endTime: values.endTime,
                });
                toast.success("Availability block added");
                form.reset();
                await load();
                renderBlocks();
                renderTable();
              } catch (error) {
                const message = getErrorMessage(error, "Could not add availability");
                toast.error(
                  String(message).toLowerCase().includes("duplicate")
                    ? "This practitioner already has a block starting at that time on that day."
                    : message,
                );
              } finally {
                submit.disabled = false;
                submit.innerHTML = `${icon("plus", "icon-sm")}Add`;
              }
            });

            renderBlocks();
          },
        });
      };

      search.addEventListener("input", () => {
        term = search.value;
        renderTable();
      });
      renderTable();
    },
  };
}

/* ========================================================================== */
/* Analytics                                                                  */
/* ========================================================================== */

export async function renderAnalytics() {
  const today = todayInClinicTimeZone();
  const since = addDays(today, -29);
  let data = { revenue: [], hours: [], appointments: [], invoices: [], items: [] };
  let loadError = "";

  try {
    const [revenue, hours, appointments, invoices, items] = await Promise.all([
      api.listDailyRevenue(since),
      api.listBusiestHours(),
      api.listAppointmentRows(since),
      api.listInvoiceRows(since),
      api.listInvoiceItemRows(),
    ]);
    data = { revenue, hours, appointments, invoices, items };
  } catch (error) {
    loadError = getErrorMessage(error, "Could not load analytics");
  }

  const totalRevenue = data.revenue.reduce((sum, row) => sum + Number(row.revenue), 0);
  const nonCancelled = data.appointments.filter((row) => row.status !== "cancelled");
  const noShows = nonCancelled.filter((row) => row.status === "no_show").length;
  const noShowRate = nonCancelled.length === 0 ? 0 : (noShows / nonCancelled.length) * 100;
  const paidInvoices = data.invoices.filter((row) => row.status === "paid");
  const averageInvoice =
    paidInvoices.length === 0
      ? 0
      : paidInvoices.reduce((sum, row) => sum + Number(row.total), 0) / paidInvoices.length;

  const topMap = new Map();
  for (const item of data.items) {
    if (!item.invoice || item.invoice.status !== "paid") continue;
    const current = topMap.get(item.description) || { quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += item.quantity * Number(item.unit_price);
    topMap.set(item.description, current);
  }
  const topItems = [...topMap.entries()]
    .map(([description, stats]) => ({ description, ...stats }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const revenueChart = data.revenue.map((row) => ({
    label: row.day,
    value: Number(row.revenue),
    day: row.day,
  }));
  const hoursChart = data.hours.map((row) => ({
    label: `${String(row.hour).padStart(2, "0")}:00`,
    value: Number(row.appointments),
    hour: row.hour,
  }));

  const revenueChartHtml = revenueChart.length
    ? lineChart(revenueChart, {
        ariaLabel: "Daily revenue",
        formatY: (value) => formatCurrency(value),
        labelFormatter: (row) =>
          new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          }).format(new Date(`${row.day}T12:00:00Z`)),
        tooltip: (row) => `${formatDate(row.day)} · ${formatCurrency(row.value)}`,
      })
    : "";

  const hoursChartHtml = hoursChart.length
    ? barChart(hoursChart, {
        ariaLabel: "Busiest hours",
        tooltip: (row) => `${row.label} · ${row.value} appointment${row.value === 1 ? "" : "s"}`,
      })
    : "";

  const html = `<div class="stack">
    ${pageHeader({
      title: "Analytics",
      description: "Revenue, demand and collection health for the last 30 days.",
    })}

    ${
      loadError
        ? `<div class="card pad between" style="flex-wrap:wrap">
            <p class="small row" style="color:#e11d48">${icon("alert", "icon-sm")}${escapeHtml(
              loadError,
            )}</p>
            ${button("Try again", { variant: "outline", size: "sm", action: "reload" })}
          </div>`
        : ""
    }

    <div class="stat-grid">
      ${statCard({
        label: "Revenue (30 days)",
        value: loadError ? "—" : formatCurrency(totalRevenue),
        hint: `${paidInvoices.length} paid invoices`,
        iconName: "card",
      })}
      ${statCard({
        label: "Appointments",
        value: loadError ? "—" : nonCancelled.length,
        hint: "Cancelled visits excluded",
        tone: "accent",
        iconName: "calendar",
      })}
      ${statCard({
        label: "No-show rate",
        value: loadError ? "—" : `${noShowRate.toFixed(1)}%`,
        hint: `${noShows} no-shows recorded`,
        tone: noShowRate > 10 ? "rose" : "brand",
        iconName: "alert",
      })}
      ${statCard({
        label: "Average invoice",
        value: loadError ? "—" : formatCurrency(averageInvoice),
        hint: "Paid invoices only",
        tone: "amber",
        iconName: "chart",
      })}
    </div>

    <div class="card">
      ${cardHead({ title: "Daily revenue", description: "Paid invoices grouped by day." })}
      ${
        loadError
          ? inlineLoader("Retry to load revenue")
          : revenueChartHtml
            ? `<div class="chart-box">${revenueChartHtml}</div>`
            : `<p class="empty-desc" style="padding:3rem 1.25rem;text-align:center;max-width:none">
                No paid invoices in this period yet.
              </p>`
      }
    </div>

    <div class="grid grid-2">
      <div class="card">
        ${cardHead({ title: "Busiest hours", description: "All non-cancelled appointments." })}
        ${
          loadError
            ? inlineLoader("Retry to load demand")
            : hoursChartHtml
              ? `<div class="chart-box short">${hoursChartHtml}</div>`
              : `<p class="empty-desc" style="padding:3rem 1.25rem;text-align:center;max-width:none">
                  Not enough appointment data yet.
                </p>`
        }
      </div>

      <div class="card">
        ${cardHead({ title: "Top-selling items", description: "By paid revenue in this period." })}
        ${
          loadError
            ? inlineLoader("Retry to rank items")
            : topItems.length === 0
              ? `<p class="empty-desc" style="padding:3rem 1.25rem;text-align:center;max-width:none">
                  Line items from paid invoices will appear here.
                </p>`
              : `<ul>${topItems
                  .map(
                    (item, index) => `<li class="top-item-row">
                      <div class="row gap-3">
                        <span class="rank">${index + 1}</span>
                        <div>
                          <p class="small strong">${escapeHtml(item.description)}</p>
                          <p class="xs muted">${item.quantity} sold</p>
                        </div>
                      </div>
                      <span class="small strong">${escapeHtml(formatCurrency(item.revenue))}</span>
                    </li>`,
                  )
                  .join("")}</ul>`
        }
      </div>
    </div>
  </div>`;

  return {
    html,
    mount(root) {
      mountCharts(root);
      const reload = root.querySelector('[data-action="reload"]');
      if (reload) {
        reload.addEventListener("click", () =>
          window.dispatchEvent(new PopStateEvent("popstate")),
        );
      }
    },
  };
}

/* ========================================================================== */
/* Audit logs                                                                 */
/* ========================================================================== */

const TABLES = ["appointments", "inventory_items", "invoices", "profiles"];
const ACTIONS = ["INSERT", "UPDATE", "DELETE"];

function actionTone(action) {
  if (action === "INSERT") return "emerald";
  if (action === "UPDATE") return "brand";
  if (action === "DELETE") return "rose";
  return "slate";
}

export async function renderAuditLogs() {
  const filters = { tableName: "all", action: "all" };
  let logs = [];
  let loadError = "";

  const load = async () => {
    loadError = "";
    try {
      logs = await api.listAuditLogs(filters);
    } catch (error) {
      loadError = getErrorMessage(error, "Could not load audit logs");
      logs = [];
    }
  };

  await load();

  const html = `<div class="stack">
    ${pageHeader({
      title: "Audit logs",
      description: "Immutable trail of appointment, inventory, invoice and role changes.",
    })}

    <div class="card">
      <div class="toolbar-grid" style="grid-template-columns:1fr 1fr auto;align-items:end">
        ${selectField({
          id: "audit-table",
          label: "Table",
          value: "all",
          options: [
            { value: "all", label: "All tables" },
            ...TABLES.map((table) => ({ value: table, label: table })),
          ],
        })}
        ${selectField({
          id: "audit-action",
          label: "Action",
          value: "all",
          options: [
            { value: "all", label: "All actions" },
            ...ACTIONS.map((action) => ({ value: action, label: action })),
          ],
        })}
        ${button("Reset", { variant: "outline", action: "reset" })}
      </div>
      <div id="audit-summary" class="row wrap" style="padding:0 1.25rem 1.25rem"></div>
    </div>

    <div class="card">
      <div id="audit-head"></div>
      <div id="audit-table"></div>
    </div>
  </div>`;

  return {
    html,
    mount(root) {
      const tableSelect = root.querySelector("#audit-table");
      const actionSelect = root.querySelector("#audit-action");
      const summary = root.querySelector("#audit-summary");
      const head = root.querySelector("#audit-head");
      const table = root.querySelector("#audit-table");

      const renderSummary = () => {
        summary.innerHTML = `
          ${badge(`${logs.length} entries`, "slate")}
          ${badge(`${logs.filter((row) => row.action === "INSERT").length} inserts`, "emerald")}
          ${badge(`${logs.filter((row) => row.action === "UPDATE").length} updates`, "brand")}
          ${badge(`${logs.filter((row) => row.action === "DELETE").length} deletes`, "rose")}`;
      };

      const renderTable = () => {
        head.innerHTML = cardHead({
          title: "Recent activity",
          description: "Newest first, capped at 200 entries.",
        });
        renderSummary();

        if (loadError) {
          table.innerHTML = `<div class="between" style="padding:1.25rem;flex-wrap:wrap">
            <p class="small" style="color:#e11d48">${escapeHtml(loadError)}</p>
            ${button("Try again", { variant: "outline", size: "sm", action: "reload" })}
          </div>`;
        } else if (logs.length === 0) {
          table.innerHTML = emptyState({
            title: "No audit entries",
            description: "Changes to key records will be recorded here automatically.",
            iconName: "shield",
          });
        } else {
          table.innerHTML = `<div class="scroll-x"><table class="table">
            <thead><tr>
              <th>When</th><th>Actor</th><th>Action</th><th>Table</th><th>Record</th><th>Details</th>
            </tr></thead>
            <tbody>${logs
              .map(
                (log) => `<tr>
                  <td class="top nowrap xs">${escapeHtml(formatDateTime(log.created_at))}</td>
                  <td class="top small">
                    <p class="strong">${escapeHtml((log.user && log.user.full_name) || "System")}</p>
                    <p class="xs muted capitalize">${escapeHtml((log.user && log.user.role) || "service")}</p>
                  </td>
                  <td class="top">${badge(log.action, actionTone(log.action))}</td>
                  <td class="top mono">${escapeHtml(log.table_name)}</td>
                  <td class="top mono">${
                    log.record_id ? `${escapeHtml(log.record_id.slice(0, 8))}…` : "—"
                  }</td>
                  <td class="top">${
                    log.details
                      ? `<details><summary>View JSON</summary><pre class="audit-json">${escapeHtml(
                          JSON.stringify(log.details, null, 2),
                        )}</pre></details>`
                      : '<span class="xs muted">—</span>'
                  }</td>
                </tr>`,
              )
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
      };

      const refresh = async () => {
        table.innerHTML = inlineLoader("Loading audit trail…");
        await load();
        renderTable();
      };

      tableSelect.addEventListener("change", () => {
        filters.tableName = tableSelect.value;
        void refresh();
      });
      actionSelect.addEventListener("change", () => {
        filters.action = actionSelect.value;
        void refresh();
      });
      root.querySelector('[data-action="reset"]').addEventListener("click", () => {
        filters.tableName = "all";
        filters.action = "all";
        tableSelect.value = "all";
        actionSelect.value = "all";
        void refresh();
      });

      renderTable();
    },
  };
}
