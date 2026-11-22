import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
} from "../../frontend/js/utils.js";
import {
  validateAvailability,
  validateBooking,
  validateInventoryItem,
  validateInvoice,
  validateService,
  validateSignIn,
  validateSignUp,
  validateStockMovement,
} from "../../frontend/js/validation.js";

describe("computeInvoiceTotals", () => {
  it("adds quantity × unit price and applies tax", () => {
    assert.deepEqual(
      computeInvoiceTotals(
        [
          { quantity: 2, unitPrice: 45 },
          { quantity: 1, unitPrice: 20 },
        ],
        10,
      ),
      { subtotal: 110, tax: 11, total: 121 },
    );
  });

  it("rounds to two decimals", () => {
    const totals = computeInvoiceTotals([{ quantity: 3, unitPrice: 19.99 }], 7.5);
    assert.equal(totals.subtotal, 59.97);
    assert.equal(totals.tax, 4.5);
    assert.equal(totals.total, 64.47);
  });

  it("clamps invalid rates and ignores negative quantities", () => {
    assert.deepEqual(
      computeInvoiceTotals(
        [
          { quantity: -5, unitPrice: 100 },
          { quantity: 1, unitPrice: 50 },
        ],
        -20,
      ),
      { subtotal: 50, tax: 0, total: 50 },
    );
  });

  it("caps the tax rate at 100%", () => {
    assert.equal(computeInvoiceTotals([{ quantity: 1, unitPrice: 10 }], 500).total, 20);
  });

  it("handles an empty invoice", () => {
    assert.deepEqual(computeInvoiceTotals([], 8), { subtotal: 0, tax: 0, total: 0 });
  });
});

describe("roundMoney", () => {
  it("rounds half values up", () => {
    assert.equal(roundMoney(1.005), 1.01);
    assert.equal(roundMoney(2.344), 2.34);
  });
});

describe("date helpers", () => {
  it("converts a UTC clinic date to midnight UTC", () => {
    assert.equal(clinicDateToUtc("2026-03-01", "UTC").toISOString(), "2026-03-01T00:00:00.000Z");
  });

  it("handles a positive offset timezone", () => {
    assert.equal(
      clinicDateToUtc("2026-03-01", "Asia/Kolkata").toISOString(),
      "2026-02-28T18:30:00.000Z",
    );
  });

  it("adds days across month and leap-year boundaries", () => {
    assert.equal(addDays("2026-01-31", 1), "2026-02-01");
    assert.equal(addDays("2024-02-28", 1), "2024-02-29");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });

  it("builds the clinic-day range", () => {
    assert.deepEqual(getClinicDayRange("2026-03-01"), {
      start: "2026-03-01T00:00:00.000Z",
      end: "2026-03-02T00:00:00.000Z",
    });
  });

  it("returns the input for an invalid date instead of throwing", () => {
    assert.equal(addDays("not-a-date", 1), "not-a-date");
  });
});

describe("CSV export", () => {
  it("quotes values containing commas, quotes or newlines", () => {
    assert.equal(escapeCsvCell("Plain"), "Plain");
    assert.equal(escapeCsvCell("Smith, Jane"), '"Smith, Jane"');
    assert.equal(escapeCsvCell('He said "hi"'), '"He said ""hi"""');
    assert.equal(escapeCsvCell("line\nbreak"), '"line\nbreak"');
    assert.equal(escapeCsvCell(null), "");
  });

  it("builds a header and rows", () => {
    const csv = buildCsv(
      [
        { label: "Name", value: (row) => row.name },
        { label: "Qty", value: (row) => row.qty },
      ],
      [
        { name: "Gauze", qty: 4 },
        { name: "Gloves, boxed", qty: 12 },
      ],
    );
    assert.equal(csv, 'Name,Qty\r\nGauze,4\r\n"Gloves, boxed",12');
  });
});

describe("formatting and errors", () => {
  it("formats invoice numbers from UUIDs", () => {
    assert.equal(formatInvoiceNumber("fffffff1-0000-4000-8000-000000000001"), "INV-FFFFFFF1");
  });

  it("maps exclusion constraint errors to a friendly booking message", () => {
    assert.match(
      friendlyBookingError('conflicting key value violates exclusion constraint "x"'),
      /just booked/,
    );
    assert.match(friendlyBookingError("Booking limit reached"), /5 bookings/);
    assert.equal(friendlyBookingError("Something specific"), "Something specific");
  });

  it("extracts messages from PostgREST-like errors", () => {
    assert.equal(getErrorMessage({ message: "permission denied" }, "fallback"), "permission denied");
    assert.equal(getErrorMessage(new Error("boom")), "boom");
    assert.equal(getErrorMessage(null, "fallback"), "fallback");
  });
});

describe("validation (Zod parity)", () => {
  it("validates sign-in emails and passwords", () => {
    const result = validateSignIn({ email: "not-an-email", password: "" });
    assert.equal(result.valid, false);
    assert.equal(result.errors.email, "Enter a valid email address");
    assert.equal(result.errors.password, "Password is required");
    assert.equal(validateSignIn({ email: "a@b.co", password: "x" }).valid, true);
  });

  it("enforces signup password strength and confirmation", () => {
    const result = validateSignUp({
      fullName: "A",
      email: "you@clinic.com",
      phone: "",
      password: "short",
      confirmPassword: "different",
    });
    assert.equal(result.valid, false);
    assert.equal(result.errors.fullName, "Full name is required");
    assert.equal(result.errors.password, "Use at least 8 characters");
    assert.equal(result.errors.confirmPassword, "Passwords do not match");

    assert.equal(
      validateSignUp({
        fullName: "Dr. Jane Doe",
        email: "jane@clinic.com",
        phone: "+1 555 010 2030",
        password: "ClinicFlow123!",
        confirmPassword: "ClinicFlow123!",
      }).valid,
      true,
    );
  });

  it("rejects non-uuid booking ids and empty slots", () => {
    const result = validateBooking({ serviceId: "x", staffId: "", startsAt: "", notes: "" });
    assert.equal(result.errors.serviceId, "Choose a service");
    assert.equal(result.errors.staffId, "Choose a staff member");
    assert.equal(result.errors.startsAt, "Choose a time slot");
  });

  it("builds the same validation messages for services", () => {
    const result = validateService({
      name: "A",
      description: "",
      durationMinutes: 2,
      price: -1,
      active: true,
    });
    assert.equal(result.errors.name, "Service name is required");
    assert.equal(result.errors.durationMinutes, "Minimum 5");
    assert.equal(result.errors.price, "Price cannot be negative");
  });

  it("builds an error for empty invoice line items", () => {
    const result = validateInvoice({ customerId: "x", taxRate: 200, items: [] });
    assert.equal(result.errors.customerId, "Choose a customer");
    assert.equal(result.errors.taxRate, "Maximum 100%");
    assert.equal(result.errors.items, "Add at least one line item");
  });

  it("validates inventory, stock movements and availability", () => {
    assert.equal(
      validateInventoryItem({
        name: "Gauze",
        sku: "G-1",
        category: "",
        quantity: 0,
        reorderLevel: 5,
        unitPrice: 1,
        expiryDate: "",
        supplier: "",
      }).valid,
      true,
    );
    assert.equal(
      validateStockMovement({ direction: "in", amount: 2, reason: "Delivery" }).valid,
      true,
    );
    assert.equal(
      validateStockMovement({ direction: "in", amount: 2, reason: "x" }).errors.reason,
      "Reason is required",
    );
    assert.equal(
      validateAvailability({ weekday: 1, startTime: "17:00", endTime: "09:00" }).errors.endTime,
      "End time must be after start time",
    );
  });
});
