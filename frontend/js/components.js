/**
 * Small UI primitives rendered as HTML strings. Replaces the React component
 * library (Button, Card, Field, Modal, Badge, Spinner).
 */

import { icon, crossGlyph } from "./icons.js";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONES,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONES,
  ROLE_LABELS,
  escapeHtml,
} from "./utils.js";

/* -------------------------------------------------------------------------- */
/* Logo & loaders                                                             */
/* -------------------------------------------------------------------------- */

export function logo({ size = "md", showText = true, onDark = false } = {}) {
  const markSize = size === "lg" ? "lg" : size === "sm" ? "sm" : "md";
  return `<span class="logo${onDark ? " on-dark" : ""}">
    <span class="logo-mark ${markSize}">${crossGlyph(size === "lg" ? "icon" : "icon-sm")}</span>
    ${showText ? `<span class="logo-word ${markSize}">Clinic<span class="flow">Flow</span></span>` : ""}
  </span>`;
}

export function spinner(className = "icon", label = "Loading") {
  return `<span class="spinner" role="status" aria-live="polite">
    <svg class="${className}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3"></circle>
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path>
    </svg>
    <span class="sr-only">${escapeHtml(label)}</span>
  </span>`;
}

export function fullPageLoader(label = "Loading ClinicFlow") {
  return `<div class="fullpage-loader">
    <span class="mark">${crossGlyph("icon")}</span>
    ${spinner()}
    <p class="small muted">${escapeHtml(label)}…</p>
  </div>`;
}

export function inlineLoader(label = "Loading…") {
  return `<div class="loader">${spinner()}<span>${escapeHtml(label)}</span></div>`;
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                     */
/* -------------------------------------------------------------------------- */

export function badge(text, tone = "slate", className = "") {
  return `<span class="badge badge-${tone}${className ? ` ${className}` : ""}">${escapeHtml(text)}</span>`;
}

export function appointmentStatusBadge(status) {
  const tone = APPOINTMENT_STATUS_TONES[status] || "slate";
  return badge(APPOINTMENT_STATUS_LABELS[status] || status, tone);
}

export function invoiceStatusBadge(status) {
  const tone = INVOICE_STATUS_TONES[status] || "slate";
  return badge(INVOICE_STATUS_LABELS[status] || status, tone);
}

export function roleBadge(role) {
  const tone = role === "owner" ? "accent" : role === "staff" ? "brand" : "slate";
  return badge(ROLE_LABELS[role] || role, tone);
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */

export function button(
  label,
  {
    variant = "primary",
    size = "md",
    iconName = "",
    action = "",
    type = "button",
    attrs = "",
    block = false,
    id = "",
  } = {},
) {
  const classes = ["btn", `btn-${variant}`];
  if (size === "sm") classes.push("btn-sm");
  if (size === "lg") classes.push("btn-lg");
  if (block) classes.push("btn-block");
  return `<button type="${type}" class="${classes.join(" ")}"${id ? ` id="${id}"` : ""}${
    action ? ` data-action="${action}"` : ""
  }${attrs ? ` ${attrs}` : ""}>${iconName ? icon(iconName, "icon-sm") : ""}${label}</button>`;
}

/* -------------------------------------------------------------------------- */
/* Cards, headers, stats, empty states                                        */
/* -------------------------------------------------------------------------- */

export function cardHead({ title, description = "", actions = "" }) {
  return `<div class="card-head">
    <div>
      <h2 class="card-title">${escapeHtml(title)}</h2>
      ${description ? `<p class="card-desc">${escapeHtml(description)}</p>` : ""}
    </div>
    ${actions ? `<div class="card-actions">${actions}</div>` : ""}
  </div>`;
}

export function pageHeader({ title, description = "", actions = "" }) {
  return `<div class="page-head">
    <div>
      <h1 class="page-title">${escapeHtml(title)}</h1>
      ${description ? `<p class="page-desc">${escapeHtml(description)}</p>` : ""}
    </div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ""}
  </div>`;
}

export function statCard({ label, value, hint = "", iconName = "", tone = "brand" }) {
  return `<div class="stat-card">
    <div class="stat-top">
      <div>
        <p class="stat-label">${escapeHtml(label)}</p>
        <p class="stat-value">${escapeHtml(String(value))}</p>
      </div>
      ${iconName ? `<span class="stat-icon tone-${tone}">${icon(iconName)}</span>` : ""}
    </div>
    ${hint ? `<p class="stat-hint">${escapeHtml(hint)}</p>` : ""}
  </div>`;
}

export function emptyState({ title, description = "", iconName = "", action = "" }) {
  return `<div class="empty">
    ${iconName ? `<span class="empty-icon">${icon(iconName)}</span>` : ""}
    <h3 class="empty-title">${escapeHtml(title)}</h3>
    ${description ? `<p class="empty-desc">${escapeHtml(description)}</p>` : ""}
    ${action ? `<div class="empty-action">${action}</div>` : ""}
  </div>`;
}

export function alertError(message) {
  return `<div class="alert alert-error" role="alert">${icon("alert", "icon-sm")}<span class="grow">${escapeHtml(
    message,
  )}</span></div>`;
}

export function alertWarning(message) {
  return `<div class="alert alert-warning" role="alert">${icon("alert", "icon-sm")}<span class="grow">${escapeHtml(
    message,
  )}</span></div>`;
}

/* -------------------------------------------------------------------------- */
/* Form fields                                                                */
/* -------------------------------------------------------------------------- */

export function fieldShell({ id, label = "", error = "", hint = "", errorName = id, control }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : "";
  return `<div class="field">
    ${label ? `<label class="field-label" for="${id}">${escapeHtml(label)}</label>` : ""}
    ${control(describedBy)}
    ${hint && !error ? `<p class="field-hint" id="${id}-hint">${escapeHtml(hint)}</p>` : ""}
    <p class="field-error" id="${id}-error" data-error-for="${errorName}" role="alert">${
      error ? escapeHtml(error) : ""
    }</p>
  </div>`;
}

/**
 * Writes validation messages into the field error slots of a form and toggles
 * aria-invalid. Clears previous messages first.
 */
export function showFieldErrors(form, errors = {}) {
  form.querySelectorAll("[data-error-for]").forEach((el) => {
    el.textContent = "";
  });
  form.querySelectorAll("[aria-invalid]").forEach((el) => {
    el.removeAttribute("aria-invalid");
  });
  for (const [key, message] of Object.entries(errors)) {
    if (!message) continue;
    const slot = form.querySelector(`[data-error-for="${key}"]`);
    if (slot) slot.textContent = message;
    const input = form.querySelector(`[name="${key}"]`);
    if (input) input.setAttribute("aria-invalid", "true");
  }
}

export function inputField({
  id,
  name = id,
  label = "",
  type = "text",
  value = "",
  placeholder = "",
  error = "",
  hint = "",
  attrs = "",
}) {
  return fieldShell({
    id,
    label,
    error,
    hint,
    errorName: name,
    control: (describedBy) => `<input class="input" id="${id}" name="${name}" type="${type}"
      value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"
      ${error ? 'aria-invalid="true"' : ""}${describedBy ? ` aria-describedby="${describedBy}"` : ""}
      ${attrs}>`,
  });
}

export function textareaField({
  id,
  name = id,
  label = "",
  value = "",
  placeholder = "",
  error = "",
  hint = "",
  attrs = "rows=\"3\"",
}) {
  return fieldShell({
    id,
    label,
    error,
    hint,
    errorName: name,
    control: (describedBy) => `<textarea class="textarea" id="${id}" name="${name}"
      placeholder="${escapeHtml(placeholder)}"
      ${error ? 'aria-invalid="true"' : ""}${describedBy ? ` aria-describedby="${describedBy}"` : ""}
      ${attrs}>${escapeHtml(value)}</textarea>`,
  });
}

export function selectField({
  id,
  name = id,
  label = "",
  options = [],
  value = "",
  error = "",
  hint = "",
  attrs = "",
}) {
  return fieldShell({
    id,
    label,
    error,
    hint,
    errorName: name,
    control: (describedBy) => `<select class="select" id="${id}" name="${name}"
      ${error ? 'aria-invalid="true"' : ""}${describedBy ? ` aria-describedby="${describedBy}"` : ""}
      ${attrs}>${options
        .map(
          (option) =>
            `<option value="${escapeHtml(option.value)}"${
              String(option.value) === String(value) ? " selected" : ""
            }>${escapeHtml(option.label)}</option>`,
        )
        .join("")}</select>`,
  });
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

let activeModalCleanup = null;

/**
 * Opens an accessible modal in a portal-like root. Returns a close function.
 * `onMount(panel)` runs after insertion for event binding.
 */
export function openModal({
  title,
  description = "",
  body,
  footer = "",
  size = "md",
  onMount,
  onClose,
}) {
  closeModal();
  const root = document.getElementById("modal-root");
  if (!root) return () => {};

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  root.innerHTML = `<div class="modal-backdrop" data-modal-backdrop>
    <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title"
      aria-describedby="${description ? "modal-description" : "modal-title"}" tabindex="-1">
      <div class="modal-head">
        <div>
          <h2 class="modal-title" id="modal-title">${escapeHtml(title)}</h2>
          ${description ? `<p class="modal-desc" id="modal-description">${escapeHtml(description)}</p>` : ""}
        </div>
        <button type="button" class="btn-icon" data-modal-close aria-label="Close dialog">${icon(
          "close",
          "icon-sm",
        )}</button>
      </div>
      <div class="modal-body" data-modal-body>${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ""}
    </div>
  </div>`;

  const backdrop = root.querySelector("[data-modal-backdrop]");
  const panel = root.querySelector(".modal");

  const cleanup = () => {
    document.removeEventListener("keydown", onKeyDown);
    document.body.style.overflow = previousOverflow;
    root.innerHTML = "";
    activeModalCleanup = null;
    if (typeof onClose === "function") onClose();
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") closeModal();
  };

  function close() {
    if (activeModalCleanup === close) cleanup();
  }

  activeModalCleanup = close;

  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  root.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", close);
  });
  document.addEventListener("keydown", onKeyDown);
  panel.focus();

  if (typeof onMount === "function") onMount(panel);
  return close;
}

export function closeModal() {
  if (activeModalCleanup) activeModalCleanup();
}
