/**
 * Small, dependency-free helpers shared by the PDF generator and its tests.
 * Kept separate from utils.ts so the PDF bundle only pulls what it needs.
 */

import { APP_CONFIG } from './config';
import { computeInvoiceTotals, roundMoney } from './utils';

export { computeInvoiceTotals, roundMoney };

/** Currency string that renders safely inside jsPDF (no exotic glyphs). */
export function formatMoneyPdf(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: APP_CONFIG.currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${APP_CONFIG.currency}`;
  }
}

export function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: APP_CONFIG.timeZone,
  }).format(date);
}

export function formatInvoiceNumber(id: string): string {
  return `INV-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
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
