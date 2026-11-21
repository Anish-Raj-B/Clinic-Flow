import type { AppointmentStatus, InvoiceStatus, UserRole } from '../types/database';
import { APP_CONFIG } from './config';

/* -------------------------------------------------------------------------- */
/* Class names                                                                */
/* -------------------------------------------------------------------------- */

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

export function formatDate(value: string | Date): string {
  const date = toDate(value);
  if (!isValidDate(date)) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: APP_CONFIG.timeZone,
  }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = toDate(value);
  if (!isValidDate(date)) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: APP_CONFIG.timeZone,
  }).format(date);
}

export function formatTime(value: string | Date): string {
  const date = toDate(value);
  if (!isValidDate(date)) return '—';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: APP_CONFIG.timeZone,
  }).format(date);
}

/** Today's calendar date (YYYY-MM-DD) in the clinic timezone. */
export function todayInClinicTimeZone(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_CONFIG.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Adds days to a YYYY-MM-DD string without timezone drift. */
export function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  if (!isValidDate(date)) return dateString;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Short label for a YYYY-MM-DD string, e.g. "Mon, Nov 24". */
export function formatDateInputLabel(dateString: string): string {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  if (!isValidDate(date)) return dateString;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Offset (minutes) of `timeZone` relative to UTC at the given instant.
 * Positive for zones east of UTC.
 */
export function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  const asUtc = Date.UTC(
    lookup('year'),
    lookup('month') - 1,
    lookup('day'),
    lookup('hour'),
    lookup('minute'),
    lookup('second'),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

/**
 * Converts a clinic-local date (YYYY-MM-DD) and wall-clock time into a real UTC
 * instant. Used for "today" range filters and unit tests.
 */
export function clinicDateToUtc(
  dateString: string,
  timeZone: string = APP_CONFIG.timeZone,
  hour = 0,
  minute = 0,
): Date {
  const [yearPart, monthPart, dayPart] = dateString.split('-');
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
export function getClinicDayRange(dateString: string): { start: string; end: string } {
  return {
    start: clinicDateToUtc(dateString).toISOString(),
    end: clinicDateToUtc(addDays(dateString, 1)).toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Money & formatting                                                         */
/* -------------------------------------------------------------------------- */

export function formatCurrency(value: number, currency: string = APP_CONFIG.currency): string {
  const amount = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface InvoiceLineLike {
  quantity: number;
  unitPrice: number;
}

export interface InvoiceTotals {
  subtotal: number;
  tax: number;
  total: number;
}

/** Client-side mirror of the SQL invoice math (numeric(10,2)). */
export function computeInvoiceTotals(
  items: readonly InvoiceLineLike[],
  taxRatePercent: number,
): InvoiceTotals {
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

export function formatInvoiceNumber(id: string): string {
  return `INV-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}

/** Turns raw Postgres/PostgREST errors into customer friendly text. */
export function friendlyBookingError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('conflicting key') ||
    lower.includes('exclusion') ||
    lower.includes('23p01') ||
    lower.includes('no longer available')
  ) {
    return 'That slot was just booked by someone else. Please pick another time.';
  }
  if (lower.includes('booking limit')) {
    return 'You have reached the limit of 5 bookings per hour. Please try again shortly.';
  }
  return message;
}

/* -------------------------------------------------------------------------- */
/* CSV export                                                                 */
/* -------------------------------------------------------------------------- */

export function escapeCsvCell(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ''
      : value instanceof Date
        ? value.toISOString()
        : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export interface CsvColumn<T> {
  label: string;
  value: (row: T) => unknown;
}

export function buildCsv<T>(columns: ReadonlyArray<CsvColumn<T>>, rows: readonly T[]): string {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(',');
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvCell(column.value(row))).join(','),
  );
  return [header, ...body].join('\r\n');
}

export function downloadCsv<T>(
  filename: string,
  columns: ReadonlyArray<CsvColumn<T>>,
  rows: readonly T[],
): void {
  const csv = buildCsv(columns, rows);
  downloadBlobFile(filename, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
}

export function downloadBlobFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
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

export const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Customer',
  staff: 'Staff',
  owner: 'Owner',
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
};

export const APPOINTMENT_STATUS_CLASSES: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  confirmed: 'bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  cancelled: 'bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300',
  no_show: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  void: 'Void',
};

export const INVOICE_STATUS_CLASSES: Record<InvoiceStatus, string> = {
  unpaid: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  void: 'bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300',
};

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const APPOINTMENT_STATUS_OPTIONS: AppointmentStatus[] = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
];
