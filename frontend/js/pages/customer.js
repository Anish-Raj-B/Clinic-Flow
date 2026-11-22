/**
 * Customer pages: book an appointment, my appointments, my invoices.
 * Same workflows, validation and messaging as the original React pages.
 */

import {
  appointmentStatusBadge,
  button,
  emptyState,
  inlineLoader,
  inputField,
  invoiceStatusBadge,
  openModal,
  pageHeader,
  spinner,
  textareaField,
} from "../components.js";
import { icon } from "../icons.js";
import * as api from "../api.js";
import { APP_CONFIG } from "../config.js";
import { partitionSlots } from "../slots.js";
import { getAuth, toast } from "../store.js";
import { validateBooking } from "../validation.js";
import {
  addDays,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatDateInputLabel,
  formatInvoiceNumber,
  formatTime,
  friendlyBookingError,
  getErrorMessage,
  todayInClinicTimeZone,
} from "../utils.js";

function stepHeading(step, title, description, done = false) {
  return `<div class="step-heading">
    <span class="step-bubble${done ? " done" : ""}" aria-hidden="true">${
      done ? icon("check", "icon-sm") : step
    }</span>
    <div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
    </div>
  </div>`;
}

/* ========================================================================== */
/* Book appointment                                                           */
/* ========================================================================== */

export async function renderBookAppointment(ctx) {
  const { profile } = getAuth();
  const today = todayInClinicTimeZone();
  const dateOptions = Array.from({ length: 21 }, (_, index) => addDays(today, index));

  const state = { serviceId: "", staffId: "", date: "", slot: "", notes: "" };

  let services = [];
  let staff = [];
  let loadError = "";

  try {
    [services, staff] = await Promise.all([
      api.listServices({ activeOnly: true }),
      api.listPractitioners({ withRole: true }),
    ]);
  } catch (error) {
    loadError = getErrorMessage(error, "Could not load the booking form");
  }

  const selectedService = () => services.find((item) => item.id === state.serviceId) || null;
  const selectedStaff = () => staff.find((item) => item.id === state.staffId) || null;

  const html = `<div class="stack">
    ${pageHeader({
      title: "Book an appointment",
      description: `Choose a service, practitioner and a free time with ${APP_CONFIG.clinicName}.`,
    })}
    ${loadError ? `<div class="alert alert-error">${escapeHtml(loadError)}</div>` : ""}

    <div class="card pad">
      ${stepHeading(1, "Choose a service", "Prices and durations are set by the clinic.")}
      <div id="service-list"></div>
    </div>

    <div class="card pad">
      ${stepHeading(2, "Choose a practitioner", "Slots depend on the practitioner's weekly availability.")}
      <div id="staff-list"></div>
      <p class="xs muted mt-3" id="staff-hint"></p>
    </div>

    <div class="card pad">
      ${stepHeading(3, "Pick a date and time", "Only genuinely free slots are shown.")}
      <div class="date-strip" id="date-strip"></div>
      <div class="mt-4" id="slot-area"></div>
    </div>

    <div class="card pad">
      ${stepHeading(4, "Confirm your booking", "Add optional notes for the team, then submit.")}
      <div class="confirm-grid">
        <div>
          ${textareaField({
            id: "booking-notes",
            label: "Notes for the clinic (optional)",
            placeholder: "Symptoms, preferred language, accessibility needs…",
            hint: "0/1000 characters",
            attrs: "maxlength=\"1000\"",
          })}
        </div>
        <div class="summary-box">
          <p class="section-label">Summary</p>
          <dl class="summary-list" id="booking-summary"></dl>
        </div>
      </div>
      <div class="mt-5 col" style="align-items:flex-start">
        ${button("Request appointment", {
          size: "lg",
          action: "book",
          attrs: 'id="book-submit" disabled',
        })}
        <p class="xs muted row">${icon("alert", "icon-xs")}
          You can cancel from “My appointments”. The clinic confirms each request.
        </p>
      </div>
    </div>
  </div>`;

  return {
    html,
    async mount(root) {
      const serviceList = root.querySelector("#service-list");
      const staffList = root.querySelector("#staff-list");
      const staffHint = root.querySelector("#staff-hint");
      const dateStrip = root.querySelector("#date-strip");
      const slotArea = root.querySelector("#slot-area");
      const summary = root.querySelector("#booking-summary");
      const bookButton = root.querySelector("#book-submit");
      const notes = root.querySelector("#booking-notes");
      let submitting = false;

      function renderServices() {
        if (loadError) {
          serviceList.innerHTML = `<div class="alert alert-error mt-4">${escapeHtml(loadError)}</div>`;
          return;
        }
        if (services.length === 0) {
          serviceList.innerHTML = emptyState({
            title: "No services available yet",
            description: "Ask the clinic owner to publish bookable services.",
            iconName: "calendar",
          });
          return;
        }
        serviceList.innerHTML = `<div class="choice-grid">${services
          .map((service) => {
            const active = service.id === state.serviceId;
            return `<button type="button" class="choice-card${active ? " active" : ""}"
              data-service="${service.id}" aria-pressed="${active}">
              <div class="choice-top">
                <p class="choice-title">${escapeHtml(service.name)}</p>
                <span class="choice-price">${escapeHtml(formatCurrency(service.price))}</span>
              </div>
              ${
                service.description
                  ? `<p class="choice-desc">${escapeHtml(service.description)}</p>`
                  : ""
              }
              <p class="choice-meta">${icon("clock", "icon-xs")}${service.duration_minutes} minutes</p>
            </button>`;
          })
          .join("")}</div>`;
        serviceList.querySelectorAll("[data-service]").forEach((el) => {
          el.addEventListener("click", () => {
            state.serviceId = el.dataset.service;
            state.slot = "";
            renderServices();
            renderStaff();
            renderSummary();
            renderSlots();
          });
        });
      }

      function renderStaff() {
        if (!staff.length) {
          staffList.innerHTML = emptyState({
            title: "No practitioners available",
            description: "The clinic has not added staff yet.",
            iconName: "calendar",
          });
        } else {
          staffList.innerHTML = `<div class="staff-choices">${staff
            .map((member) => {
              const active = member.id === state.staffId;
              return `<button type="button" class="staff-choice${active ? " active" : ""}"
                data-staff="${member.id}" aria-pressed="${active}" ${
                  state.serviceId ? "" : "disabled"
                }>
                ${escapeHtml(member.full_name)}<span class="role">${escapeHtml(member.role || "")}</span>
              </button>`;
            })
            .join("")}</div>`;
          staffList.querySelectorAll("[data-staff]").forEach((el) => {
            el.addEventListener("click", () => {
              state.staffId = el.dataset.staff;
              state.slot = "";
              renderStaff();
              renderDates();
              renderSlots();
              renderSummary();
            });
          });
        }
        staffHint.textContent = state.serviceId
          ? ""
          : "Select a service first to pick a practitioner.";
      }

      function renderDates() {
        dateStrip.innerHTML = dateOptions
          .map((option) => {
            const active = option === state.date;
            const weekday = formatDateInputLabel(option).split(",")[0] || "";
            const dayNumber = Number(option.slice(8, 10));
            return `<button type="button" class="date-btn${active ? " active" : ""}"
              data-date="${option}" aria-pressed="${active}" aria-label="${escapeHtml(
                formatDateInputLabel(option),
              )}" ${state.staffId ? "" : "disabled"}>
              <span class="date-weekday">${escapeHtml(weekday)}</span>
              <span class="date-day">${dayNumber}</span>
            </button>`;
          })
          .join("");
        dateStrip.querySelectorAll("[data-date]").forEach((el) => {
          el.addEventListener("click", () => {
            state.date = el.dataset.date;
            state.slot = "";
            renderDates();
            renderSlots();
            renderSummary();
          });
        });
      }

      function renderSummary() {
        const service = selectedService();
        const member = selectedStaff();
        summary.innerHTML = `
          <div><dt>Patient</dt><dd>${escapeHtml((profile && profile.full_name) || "—")}</dd></div>
          <div><dt>Service</dt><dd>${escapeHtml(service ? service.name : "—")}</dd></div>
          <div><dt>Practitioner</dt><dd>${escapeHtml(member ? member.full_name : "—")}</dd></div>
          <div><dt>When</dt><dd>${
            state.slot && state.date
              ? escapeHtml(`${formatDateInputLabel(state.date)} · ${formatTime(state.slot)}`)
              : "—"
          }</dd></div>
          <div style="border-top:1px solid var(--border);padding-top:0.375rem">
            <dt>Price</dt><dd style="color:var(--brand-700);font-weight:600">${
              service ? escapeHtml(formatCurrency(service.price)) : "—"
            }</dd>
          </div>`;
        bookButton.disabled = !(
          state.serviceId &&
          state.staffId &&
          state.date &&
          state.slot &&
          !submitting
        );
      }

      function slotGroupsHtml(slots) {
        const partitions = partitionSlots(slots, APP_CONFIG.timeZone);
        return [
          { key: "morning", label: "Morning", items: partitions.morning },
          { key: "afternoon", label: "Afternoon", items: partitions.afternoon },
          { key: "evening", label: "Evening", items: partitions.evening },
        ]
          .filter((group) => group.items.length > 0)
          .map(
            (group) => `<div class="slot-group">
              <p class="section-label">${group.label}</p>
              <div class="slot-grid">${group.items
                .map((available) => {
                  const active = available.slot_start === state.slot;
                  return `<button type="button" class="slot-btn${active ? " active" : ""}"
                    data-slot="${escapeHtml(available.slot_start)}" aria-pressed="${active}">
                    ${escapeHtml(formatTime(available.slot_start))}
                  </button>`;
                })
                .join("")}</div>
            </div>`,
          )
          .join("");
      }

      async function renderSlots() {
        if (!state.staffId || !state.date) {
          slotArea.innerHTML = `<p class="info-box text-center">
            Select a practitioner and a date to see available times.
          </p>`;
          return;
        }
        slotArea.innerHTML = inlineLoader("Checking live availability…");
        try {
          const slots = await api.listAvailableSlots(state.serviceId, state.staffId, state.date);
          if (slots.length === 0) {
            slotArea.innerHTML = emptyState({
              title: "No free slots on this day",
              description: "Try another date or practitioner. Availability is updated in real time.",
              iconName: "calendar",
            });
            return;
          }
          slotArea.innerHTML = `<div>${slotGroupsHtml(slots)}</div>`;
          slotArea.querySelectorAll("[data-slot]").forEach((el) => {
            el.addEventListener("click", () => {
              state.slot = el.dataset.slot;
              slotArea.querySelectorAll("[data-slot]").forEach((buttonEl) => {
                buttonEl.classList.toggle("active", buttonEl.dataset.slot === state.slot);
                buttonEl.setAttribute(
                  "aria-pressed",
                  buttonEl.dataset.slot === state.slot ? "true" : "false",
                );
              });
              renderSummary();
            });
          });
        } catch (error) {
          slotArea.innerHTML = `<div class="alert alert-error" style="justify-content:space-between;flex-wrap:wrap">
            <span>${escapeHtml(getErrorMessage(error, "Could not load availability"))}</span>
            ${button("Retry", { size: "sm", variant: "outline", action: "retry-slots" })}
          </div>`;
          const retry = slotArea.querySelector('[data-action="retry-slots"]');
          if (retry) retry.addEventListener("click", () => void renderSlots());
        }
      }

      const syncNotesHint = () => {
        const hint = notes.parentElement.querySelector(".field-hint");
        if (hint) hint.textContent = `${notes.value.length}/1000 characters`;
        state.notes = notes.value;
      };
      notes.addEventListener("input", syncNotesHint);
      syncNotesHint();

      bookButton.addEventListener("click", async () => {
        const result = validateBooking({
          serviceId: state.serviceId,
          staffId: state.staffId,
          startsAt: state.slot,
          notes: state.notes,
        });
        if (!result.valid) {
          const first = Object.values(result.errors)[0];
          toast.error(first || "Please complete every step");
          return;
        }
        submitting = true;
        bookButton.disabled = true;
        bookButton.innerHTML = `${spinner("icon-sm", "Booking")}Requesting…`;
        try {
          const created = await api.bookAppointment({
            serviceId: state.serviceId,
            staffId: state.staffId,
            startsAt: state.slot,
            notes: state.notes.trim() || null,
          });
          if (created) void api.notifyBookingConfirmation(created.id);
          toast.success(
            `Appointment requested for ${formatDateInputLabel(state.date)} at ${formatTime(
              state.slot,
            )}`,
          );
          ctx.navigate("/app/my-appointments");
        } catch (error) {
          toast.error(friendlyBookingError(getErrorMessage(error, "Could not book this slot")));
          submitting = false;
          renderSummary();
          void renderSlots();
        }
      });

      renderServices();
      renderStaff();
      renderDates();
      renderSummary();
      void renderSlots();
    },
  };
}

/* ========================================================================== */
/* My appointments                                                            */
/* ========================================================================== */

const ACTIVE_STATUSES = new Set(["pending", "confirmed"]);

function appointmentRow(appointment, allowCancel) {
  const dateText = formatDate(appointment.starts_at);
  const parts = dateText.split(" ");
  return `<li class="apt-row">
    <div class="row-top">
      <div class="date-chip">
        <span class="weekday">${escapeHtml(parts[0] || "")}</span>
        <span class="day">${escapeHtml((parts[1] || "").replace(",", ""))}</span>
        <span class="time">${escapeHtml(formatTime(appointment.starts_at))}</span>
      </div>
      <div>
        <p class="small strong">${escapeHtml(
          (appointment.service && appointment.service.name) || "Appointment",
        )}</p>
        <p class="xs muted row wrap" style="gap:0.75rem;margin-top:0.125rem">
          <span class="row gap-1">${icon("clock", "icon-xs")}
            ${escapeHtml(formatTime(appointment.starts_at))} – ${escapeHtml(
              formatTime(appointment.ends_at),
            )}
          </span>
          <span>with ${escapeHtml(
            (appointment.staff && appointment.staff.full_name) || "clinic team",
          )}</span>
          ${
            appointment.service
              ? `<span class="strong">${escapeHtml(formatCurrency(appointment.service.price))}</span>`
              : ""
          }
        </p>
        ${
          appointment.notes
            ? `<p class="xs muted mt-1">Note: ${escapeHtml(appointment.notes)}</p>`
            : ""
        }
      </div>
    </div>
    <div class="row gap-2" style="flex-shrink:0">
      ${appointmentStatusBadge(appointment.status)}
      ${
        allowCancel
          ? button("Cancel", {
              size: "sm",
              variant: "outline",
              action: "cancel",
              attrs: `data-id="${appointment.id}" style="border-color:rgba(244,63,94,.35);color:#be123c"`,
            })
          : ""
      }
    </div>
  </li>`;
}

export async function renderMyAppointments(ctx) {
  let appointments = [];
  let loadError = "";

  try {
    appointments = await api.listMyAppointments();
  } catch (error) {
    loadError = getErrorMessage(error, "Could not load your appointments");
  }

  const html = `<div class="stack">
    ${pageHeader({
      title: "My appointments",
      description: "Upcoming visits and your appointment history.",
      actions: `<a class="btn btn-primary" href="/app/book" data-link>${icon(
        "plus",
        "icon-sm",
      )}Book appointment</a>`,
    })}
    <div id="my-appointments"></div>
  </div>`;

  return {
    html,
    mount(root) {
      const container = root.querySelector("#my-appointments");

      const renderList = () => {
        if (loadError) {
          container.innerHTML = `<div class="card pad">
            <div class="between" style="flex-wrap:wrap">
              <p class="small" style="color:#e11d48">${escapeHtml(loadError)}</p>
              ${button("Try again", { variant: "outline", size: "sm", action: "reload" })}
            </div>
          </div>`;
        } else {
          const now = Date.now();
          const upcoming = appointments.filter(
            (appointment) =>
              ACTIVE_STATUSES.has(appointment.status) &&
              new Date(appointment.starts_at).getTime() >= now,
          );
          const upcomingIds = new Set(upcoming.map((appointment) => appointment.id));
          const history = appointments.filter((appointment) => !upcomingIds.has(appointment.id));

          container.innerHTML = `
            <div class="card">
              <div class="card-head">
                <div>
                  <h2 class="card-title">Upcoming</h2>
                  <p class="card-desc">${upcoming.length} appointment${
                    upcoming.length === 1 ? "" : "s"
                  } scheduled</p>
                </div>
              </div>
              ${
                upcoming.length === 0
                  ? emptyState({
                      title: "Nothing booked yet",
                      description: "Book your first visit and it will show up here.",
                      iconName: "calendar",
                      action: `<a class="btn btn-primary btn-sm" href="/app/book" data-link>Book an appointment</a>`,
                    })
                  : `<ul class="divide">${upcoming
                      .map((appointment) => appointmentRow(appointment, true))
                      .join("")}</ul>`
              }
            </div>
            <div class="card mt-6">
              <div class="card-head">
                <div>
                  <h2 class="card-title">History</h2>
                  <p class="card-desc">Past and cancelled appointments.</p>
                </div>
              </div>
              ${
                history.length === 0
                  ? emptyState({
                      title: "No past appointments",
                      description: "Your history will appear here.",
                    })
                  : `<ul class="divide">${history
                      .map((appointment) => appointmentRow(appointment, false))
                      .join("")}</ul>`
              }
            </div>`;
        }

        const reload = container.querySelector('[data-action="reload"]');
        if (reload) {
          reload.addEventListener("click", async () => {
            loadError = "";
            try {
              appointments = await api.listMyAppointments();
            } catch (error) {
              loadError = getErrorMessage(error, "Could not load your appointments");
            }
            renderList();
          });
        }

        container.querySelectorAll('[data-action="cancel"]').forEach((el) => {
          el.addEventListener("click", () => {
            const appointment = appointments.find((item) => item.id === el.dataset.id);
            if (appointment) openCancelModal(appointment);
          });
        });
      };

      const openCancelModal = (appointment) => {
        const close = openModal({
          title: "Cancel this appointment?",
          description: "The slot will be released for other patients immediately.",
          size: "sm",
          body: `<div class="info-box">
            <p class="strong">${escapeHtml(
              (appointment.service && appointment.service.name) || "Appointment",
            )}</p>
            <p class="mt-1 muted">${escapeHtml(formatDate(appointment.starts_at))} at ${escapeHtml(
              formatTime(appointment.starts_at),
            )} with ${escapeHtml(
              (appointment.staff && appointment.staff.full_name) || "the clinic team",
            )}</p>
          </div>`,
          footer: `${button("Keep it", {
            variant: "outline",
            action: "keep",
          })}${button("Cancel appointment", { variant: "danger", action: "confirm-cancel" })}`,
          onMount(panel) {
            panel.querySelector('[data-action="keep"]').addEventListener("click", () => close());
            const confirm = panel.querySelector('[data-action="confirm-cancel"]');
            confirm.addEventListener("click", async () => {
              confirm.disabled = true;
              confirm.innerHTML = `${spinner("icon-sm", "Cancelling")}Cancelling…`;
              try {
                await api.cancelAppointment(appointment.id);
                toast.success("Appointment cancelled");
                close();
                try {
                  appointments = await api.listMyAppointments();
                } catch (error) {
                  loadError = getErrorMessage(error, "Could not refresh your appointments");
                }
                renderList();
              } catch (error) {
                toast.error(getErrorMessage(error, "Could not cancel the appointment"));
                confirm.disabled = false;
                confirm.textContent = "Cancel appointment";
              }
            });
          },
        });
      };

      renderList();
    },
  };
}

/* ========================================================================== */
/* My invoices                                                                */
/* ========================================================================== */

export async function renderMyInvoices() {
  let invoices = [];
  let loadError = "";

  try {
    invoices = await api.listInvoices();
  } catch (error) {
    loadError = getErrorMessage(error, "Could not load your invoices");
  }

  const html = `<div class="stack">
    ${pageHeader({
      title: "My invoices",
      description: "Download a PDF copy of any invoice for your records.",
    })}
    <div class="card">
      <div class="card-head">
        <div>
          <h2 class="card-title">Invoices</h2>
          <p class="card-desc">${invoices.length} total</p>
        </div>
      </div>
      <div id="invoice-table"></div>
    </div>
  </div>`;

  return {
    html,
    mount(root) {
      const container = root.querySelector("#invoice-table");

      const download = async (invoice) => {
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

      const openDetail = (invoice) => {
        const close = openModal({
          title: formatInvoiceNumber(invoice.id),
          description: `Issued ${formatDate(invoice.created_at)}`,
          size: "lg",
          body: `<div class="invoice-detail">
            <div class="between wrap">
              <div>
                <p class="section-label">Billed to</p>
                <p class="small strong">${escapeHtml(
                  (invoice.customer && invoice.customer.full_name) || "Customer",
                )}</p>
              </div>
              ${invoiceStatusBadge(invoice.status)}
            </div>
            <div class="invoice-lines">
              <table class="table">
                <thead><tr>
                  <th>Description</th><th class="text-right">Qty</th>
                  <th class="text-right">Unit price</th><th class="text-right">Amount</th>
                </tr></thead>
                <tbody>${(invoice.invoice_items || [])
                  .map(
                    (item) => `<tr>
                      <td>${escapeHtml(item.description)}</td>
                      <td class="text-right">${item.quantity}</td>
                      <td class="text-right">${escapeHtml(formatCurrency(item.unit_price))}</td>
                      <td class="text-right strong">${escapeHtml(
                        formatCurrency(item.quantity * item.unit_price),
                      )}</td>
                    </tr>`,
                  )
                  .join("")}</tbody>
              </table>
            </div>
            <dl class="totals ml-auto">
              <div><dt class="muted">Subtotal</dt><dd>${escapeHtml(
                formatCurrency(invoice.subtotal),
              )}</dd></div>
              <div><dt class="muted">Tax</dt><dd>${escapeHtml(formatCurrency(invoice.tax))}</dd></div>
              <div class="grand"><dt>Total</dt><dd>${escapeHtml(
                formatCurrency(invoice.total),
              )}</dd></div>
            </dl>
          </div>`,
          footer: `${button("Close", {
            variant: "outline",
            action: "close",
          })}${button(`<span>${icon("download", "icon-sm")}Download PDF</span>`, {
            action: "download",
          })}`,
          onMount(panel) {
            panel.querySelector('[data-action="close"]').addEventListener("click", () => close());
            panel.querySelector('[data-action="download"]').addEventListener("click", () => {
              void download(invoice);
            });
          },
        });
      };

      const renderTable = () => {
        if (loadError) {
          container.innerHTML = `<div class="between" style="padding:1.25rem;flex-wrap:wrap">
            <p class="small" style="color:#e11d48">${escapeHtml(loadError)}</p>
            ${button("Try again", { variant: "outline", size: "sm", action: "reload" })}
          </div>`;
        } else if (invoices.length === 0) {
          container.innerHTML = emptyState({
            title: "No invoices yet",
            description: "Invoices created after your visits will appear here.",
            iconName: "file",
          });
        } else {
          container.innerHTML = `<div class="scroll-x"><table class="table">
            <thead><tr>
              <th>Invoice</th><th>Issued</th><th>Amount</th><th>Status</th>
              <th class="text-right">Actions</th>
            </tr></thead>
            <tbody>${invoices
              .map(
                (invoice) => `<tr>
                  <td class="strong">${escapeHtml(formatInvoiceNumber(invoice.id))}</td>
                  <td>${escapeHtml(formatDate(invoice.created_at))}</td>
                  <td class="strong">${escapeHtml(formatCurrency(invoice.total))}</td>
                  <td>${invoiceStatusBadge(invoice.status)}</td>
                  <td><div class="actions">
                    ${button("View", { size: "sm", variant: "ghost", action: "view", attrs: `data-id="${invoice.id}"` })}
                    ${button(`${icon("download", "icon-sm")}PDF`, {
                      size: "sm",
                      variant: "outline",
                      action: "pdf",
                      attrs: `data-id="${invoice.id}"`,
                    })}
                  </div></td>
                </tr>`,
              )
              .join("")}</tbody>
          </table></div>`;
        }

        container.querySelectorAll('[data-action="view"]').forEach((el) => {
          el.addEventListener("click", () => {
            const invoice = invoices.find((item) => item.id === el.dataset.id);
            if (invoice) openDetail(invoice);
          });
        });
        container.querySelectorAll('[data-action="pdf"]').forEach((el) => {
          el.addEventListener("click", () => {
            const invoice = invoices.find((item) => item.id === el.dataset.id);
            if (invoice) void download(invoice);
          });
        });
        const reload = container.querySelector('[data-action="reload"]');
        if (reload) {
          reload.addEventListener("click", async () => {
            loadError = "";
            try {
              invoices = await api.listInvoices();
            } catch (error) {
              loadError = getErrorMessage(error, "Could not load your invoices");
            }
            renderTable();
          });
        }
      };

      renderTable();
    },
  };
}

