import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildCsv,
  clinicDateToUtc,
  computeInvoiceTotals,
  escapeCsvCell,
  formatInvoiceNumber,
  friendlyBookingError,
  getClinicDayRange,
  getErrorMessage,
  roundMoney,
} from '../utils';

describe('computeInvoiceTotals', () => {
  it('adds quantity × unit price and applies tax', () => {
    const totals = computeInvoiceTotals(
      [
        { quantity: 2, unitPrice: 45 },
        { quantity: 1, unitPrice: 20 },
      ],
      10,
    );
    expect(totals).toEqual({ subtotal: 110, tax: 11, total: 121 });
  });

  it('rounds to two decimals', () => {
    const totals = computeInvoiceTotals([{ quantity: 3, unitPrice: 19.99 }], 7.5);
    expect(totals.subtotal).toBe(59.97);
    expect(totals.tax).toBe(4.5);
    expect(totals.total).toBe(64.47);
  });

  it('clamps invalid rates and ignores negative quantities', () => {
    const totals = computeInvoiceTotals(
      [
        { quantity: -5, unitPrice: 100 },
        { quantity: 1, unitPrice: 50 },
      ],
      -20,
    );
    expect(totals).toEqual({ subtotal: 50, tax: 0, total: 50 });
  });

  it('caps the tax rate at 100%', () => {
    expect(computeInvoiceTotals([{ quantity: 1, unitPrice: 10 }], 500).total).toBe(20);
  });

  it('handles an empty invoice', () => {
    expect(computeInvoiceTotals([], 8)).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });
});

describe('roundMoney', () => {
  it('rounds half values up', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.344)).toBe(2.34);
  });
});

describe('date helpers', () => {
  it('converts a UTC clinic date to midnight UTC', () => {
    expect(clinicDateToUtc('2026-03-01', 'UTC').toISOString()).toBe(
      '2026-03-01T00:00:00.000Z',
    );
  });

  it('handles a positive offset timezone', () => {
    expect(clinicDateToUtc('2026-03-01', 'Asia/Kolkata').toISOString()).toBe(
      '2026-02-28T18:30:00.000Z',
    );
  });

  it('adds days across month and leap-year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('builds the clinic-day range', () => {
    expect(getClinicDayRange('2026-03-01')).toEqual({
      start: '2026-03-01T00:00:00.000Z',
      end: '2026-03-02T00:00:00.000Z',
    });
  });

  it('returns the input for an invalid date instead of throwing', () => {
    expect(addDays('not-a-date', 1)).toBe('not-a-date');
  });
});

describe('CSV export', () => {
  it('quotes values containing commas, quotes or newlines', () => {
    expect(escapeCsvCell('Plain')).toBe('Plain');
    expect(escapeCsvCell('Smith, Jane')).toBe('"Smith, Jane"');
    expect(escapeCsvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(escapeCsvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(escapeCsvCell(null)).toBe('');
  });

  it('builds a header and rows', () => {
    const csv = buildCsv(
      [
        { label: 'Name', value: (row: { name: string; qty: number }) => row.name },
        { label: 'Qty', value: (row: { name: string; qty: number }) => row.qty },
      ],
      [
        { name: 'Gauze', qty: 4 },
        { name: 'Gloves, boxed', qty: 12 },
      ],
    );
    expect(csv).toBe('Name,Qty\r\nGauze,4\r\n"Gloves, boxed",12');
  });
});

describe('formatting and errors', () => {
  it('formats invoice numbers from UUIDs', () => {
    expect(formatInvoiceNumber('fffffff1-0000-4000-8000-000000000001')).toBe('INV-FFFFFFF1');
  });

  it('maps exclusion constraint errors to a friendly booking message', () => {
    expect(
      friendlyBookingError('conflicting key value violates exclusion constraint "x"'),
    ).toContain('just booked');
    expect(friendlyBookingError('Booking limit reached')).toContain('5 bookings');
    expect(friendlyBookingError('Something specific')).toBe('Something specific');
  });

  it('extracts messages from PostgREST-like errors', () => {
    expect(getErrorMessage({ message: 'permission denied' }, 'fallback')).toBe('permission denied');
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
