/**
 * Shared formatting, date, money, CSV and error helpers.
 * Direct port of the original TypeScript module.
 */

import { APP_CONFIG } from "./config.js";

/* -------------------------------------------------------------------------- */
/* Class names                                                                */
/* -------------------------------------------------------------------------- */

export function cn(...values) {
  return values.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

export function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function isValidDate(date) {
  return !Number.isNaN(date.getTime());
}

export function formatDate(value) {
  const date = toDate(value);
  if (!isValidDate(date)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: APP_CONFIG.timeZone,
  }).format(date);
}

export function formatDateTime(value) {
  const date = toDate(value);
  if (!isValidDate(date)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_CONFIG.timeZone,
  }).format(date);
}

export function formatTime(value) {
  const date = toDate(value);
  if (!isValidDate(date)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_CONFIG.timeZone,
  }).format(date);
}

/** Today's calendar date (YYYY-MM-DD) in the clinic timezone. */
export function todayInClinicTimeZone() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_CONFIG.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Adds days to a YYYY-MM-DD string without timezone drift. */
export function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  if (!isValidDate(date)) return dateString;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Short label for a YYYY-MM-DD string, e.g. "Mon, Nov 24". */
export function formatDateInputLabel(dateString) {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  if (!isValidDate(date)) return dateString;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Offset (minutes) of `timeZone` relative to UTC at the given instant.
 * Positive for zones east of UTC.
 */
export function getTimeZoneOffsetMinutes(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const lookup = (type) => {
    const part = parts.find((entry) => entry.type === type);
    return Number(part ? part.value : "0");
  };

  const asUtc = Date.UTC(
    lookup("year"),
    lookup("month") - 1,
    lookup("day"),
    lookup("hour"),
    lookup("minute"),
    lookup("second"),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

/**
 * Converts a clinic-local date (YYYY-MM-DD) and wall-clock time into a real UTC
 * instant. Used for "today" range filters and unit tests.
 */
export function clinicDateToUtc(dateString, timeZone = APP_CONFIG.timeZone, hour = 0, minute = 0) {
  const [yearPart, monthPart, dayPart] = String(dateString).split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  if (!year || !month || !day) {
    throw new Error(`Invalid date string: ${dateString}`);
  }

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstOffset = getTimeZoneOffsetMinutes(new Date(utcGuess), timeZone);
  let result = new Date(utcGuess - firstOffset * 60000);
  const secondOffset = getTimeZoneOffsetMinutes(result, timeZone);
  if (secondOffset !== firstOffset) {
    result = new Date(utcGuess - secondOffset * 60000);
  }
  return result;
}

/** UTC ISO boundaries for one clinic-local calendar day. */
export function getClinicDayRange(dateString) {
  return {
    start: clinicDateToUtc(dateString).toISOString(),
    end: clinicDateToUtc(addDays(dateString, 1)).toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Money & formatting                                                         */
/* -------------------------------------------------------------------------- */

export function formatCurrency(value, currency = APP_CONFIG.currency) {
  const amount = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Client-side mirror of the SQL invoice math (numeric(10,2)). */
export function computeInvoiceTotals(items, taxRatePercent) {
  const safeRate = Number.isFinite(taxRatePercent)
    ? Math.min(Math.max(taxRatePercent, 0), 100)
    : 0;
  const subtotal = roundMoney(
    items.reduce((sum, item) => {
      const quantity = Number.isFinite(item.quantity) ? Math.max(item.quantity, 0) : 0;
      const price = Number.isFinite(item.unitPrice) ? Math.max(item.unitPrice, 0) : 0;
      return sum + quantity * price;
    }, 0),
  );
  const tax = roundMoney((subtotal * safeRate) / 100);
  return { subtotal, tax, total: roundMoney(subtotal + tax) };
}

export function formatInvoiceNumber(id) {
  return `INV-${String(id).replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function initials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export function getErrorMessage(error, fallback = "Something went wrong") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}

/** Turns raw Postgres/PostgREST errors into customer friendly text. */
export function friendlyBookingError(message) {
  const lower = String(message).toLowerCase();
  if (
    lower.includes("conflicting key") ||
    lower.includes("exclusion") ||
    lower.includes("23p01") ||
    lower.includes("no longer available")
  ) {
    return "That slot was just booked by someone else. Please pick another time.";
  }
  if (lower.includes("booking limit")) {
    return "You have reached the limit of 5 bookings per hour. Please try again shortly.";
  }
  return message;
}

/* -------------------------------------------------------------------------- */
/* CSV export                                                                 */
/* -------------------------------------------------------------------------- */

export function escapeCsvCell(value) {
  const text =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(columns, rows) {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvCell(column.value(row))).join(","),
  );
  return [header, ...body].join("\r\n");
}

export function downloadCsv(filename, columns, rows) {
  const csv = buildCsv(columns, rows);
  downloadBlobFile(filename, new Blob([csv], { type: "text/csv;charset=utf-8;" }));
}

export function downloadBlobFile(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------- */
/* Display maps                                                               */
/* -------------------------------------------------------------------------- */

export const ROLE_LABELS = {
  customer: "Customer",
  staff: "Staff",
  owner: "Owner",
};

export const APPOINTMENT_STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

export const APPOINTMENT_STATUS_TONES = {
  pending: "amber",
  confirmed: "brand",
  completed: "emerald",
  cancelled: "slate",
  no_show: "rose",
};

export const INVOICE_STATUS_LABELS = {
  unpaid: "Unpaid",
  paid: "Paid",
  void: "Void",
};

export const INVOICE_STATUS_TONES = {
  unpaid: "amber",
  paid: "emerald",
  void: "slate",
};

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const APPOINTMENT_STATUS_OPTIONS = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];

/* -------------------------------------------------------------------------- */
/* Small DOM helpers                                                          */
/* -------------------------------------------------------------------------- */

export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
