/**
 * Client-side validation. Replaces the Zod schemas one-for-one, keeping the
 * same rules and messages. The database CHECK constraints remain authoritative.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function required(label, value, min = 1, max = 120) {
  const text = String(value ?? "").trim();
  if (text.length < min) return `${label} is required`;
  if (text.length > max) return `${label} must be ${max} characters or fewer`;
  return null;
}

function optionalText(value, max) {
  const text = String(value ?? "").trim();
  if (text.length > max) return `Must be ${max} characters or fewer`;
  return null;
}

function numeric(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function intRange(value, { label, min, max, integerMessage = "Use whole units" }) {
  const number = numeric(value);
  if (number === null) return `Enter a ${label}`;
  if (!Number.isInteger(number)) return integerMessage;
  if (number < min) {
    if (min === 0) return `${label} cannot be negative`;
    if (min === 1) return "At least 1";
    return `Minimum ${min}`;
  }
  if (number > max) return `${label} is too large`;
  return null;
}

function emailError(value) {
  const text = String(value ?? "").trim();
  if (!text) return "Email is required";
  if (!EMAIL_RE.test(text)) return "Enter a valid email address";
  return null;
}

function passwordError(value) {
  const text = String(value ?? "");
  if (text.length < 8) return "Use at least 8 characters";
  if (text.length > 72) return "Use at most 72 characters";
  if (!/[A-Za-z]/.test(text)) return "Include at least one letter";
  if (!/[0-9]/.test(text)) return "Include at least one number";
  return null;
}

function collect(errors) {
  const cleaned = {};
  for (const [key, value] of Object.entries(errors)) {
    if (value) cleaned[key] = value;
  }
  return { valid: Object.keys(cleaned).length === 0, errors: cleaned };
}

export function validateSignIn(values) {
  return collect({
    email: emailError(values.email),
    password: String(values.password ?? "").length === 0 ? "Password is required" : null,
  });
}

export function validateSignUp(values) {
  return collect({
    fullName: required("Full name", values.fullName, 2, 100),
    email: emailError(values.email),
    phone: optionalText(values.phone, 30),
    password: passwordError(values.password),
    confirmPassword:
      String(values.confirmPassword ?? "").length === 0
        ? "Confirm your password"
        : values.confirmPassword !== values.password
          ? "Passwords do not match"
          : null,
  });
}

export function validateForgotPassword(values) {
  return collect({ email: emailError(values.email) });
}

export function validateNewPassword(values) {
  return collect({
    password: passwordError(values.password),
    confirmPassword:
      String(values.confirmPassword ?? "").length === 0
        ? "Confirm your password"
        : values.confirmPassword !== values.password
          ? "Passwords do not match"
          : null,
  });
}

export function validateBooking(values) {
  return collect({
    serviceId: UUID_RE.test(String(values.serviceId ?? "")) ? null : "Choose a service",
    staffId: UUID_RE.test(String(values.staffId ?? "")) ? null : "Choose a staff member",
    startsAt: String(values.startsAt ?? "").length === 0 ? "Choose a time slot" : null,
    notes: optionalText(values.notes, 1000),
  });
}

export function validateService(values) {
  return collect({
    name: required("Service name", values.name, 2, 80),
    description: optionalText(values.description, 1000),
    durationMinutes: intRange(values.durationMinutes, {
      label: "duration",
      min: 5,
      max: 480,
      integerMessage: "Use whole minutes",
    }),
    price: (() => {
      const price = numeric(values.price);
      if (price === null) return "Enter a price";
      if (price < 0) return "Price cannot be negative";
      if (price > 1000000) return "Price is too large";
      return null;
    })(),
  });
}

export function validateInventoryItem(values) {
  return collect({
    name: required("Item name", values.name, 2, 120),
    sku: required("SKU", values.sku, 1, 60),
    category: optionalText(values.category, 60),
    quantity: intRange(values.quantity, { label: "quantity", min: 0, max: 1000000 }),
    reorderLevel: intRange(values.reorderLevel, {
      label: "reorder level",
      min: 0,
      max: 1000000,
    }),
    unitPrice: (() => {
      const price = numeric(values.unitPrice);
      if (price === null) return "Enter a unit price";
      if (price < 0) return "Price cannot be negative";
      if (price > 1000000) return "Price is too large";
      return null;
    })(),
    expiryDate: optionalText(values.expiryDate, 10),
    supplier: optionalText(values.supplier, 120),
  });
}

export function validateStockMovement(values) {
  return collect({
    direction: values.direction === "in" || values.direction === "out" ? null : "Choose a direction",
    amount: intRange(values.amount, {
      label: "quantity",
      min: 1,
      max: 100000,
    }),
    reason: required("Reason", values.reason, 3, 200),
  });
}

export function validateInvoice(values) {
  const errors = {
    customerId: UUID_RE.test(String(values.customerId ?? "")) ? null : "Choose a customer",
    taxRate: (() => {
      const rate = numeric(values.taxRate);
      if (rate === null) return "Enter a tax rate";
      if (rate < 0) return "Minimum 0%";
      if (rate > 100) return "Maximum 100%";
      return null;
    })(),
    items: null,
    itemErrors: [],
  };

  const items = Array.isArray(values.items) ? values.items : [];
  if (items.length === 0) {
    errors.items = "Add at least one line item";
  } else {
    errors.itemErrors = items.map((item) => {
      const lineErrors = {};
      const description = required("Description", item.description, 1, 200);
      if (description) lineErrors.description = description;

      const quantity = numeric(item.quantity);
      if (quantity === null) lineErrors.quantity = "Enter a quantity";
      else if (!Number.isInteger(quantity)) lineErrors.quantity = "Use whole units";
      else if (quantity < 1) lineErrors.quantity = "At least 1";
      else if (quantity > 10000) lineErrors.quantity = "Too many";

      const price = numeric(item.unitPrice);
      if (price === null) lineErrors.unitPrice = "Enter a price";
      else if (price < 0) lineErrors.unitPrice = "Cannot be negative";
      else if (price > 1000000) lineErrors.unitPrice = "Too large";

      return lineErrors;
    });
    if (errors.itemErrors.some((line) => Object.keys(line).length > 0)) {
      errors.items = "Fix the highlighted line items";
    }
  }

  const result = collect(errors);
  result.itemErrors = errors.itemErrors;
  return result;
}

export function validateAvailability(values) {
  const weekday = numeric(values.weekday);
  const startTime = String(values.startTime ?? "");
  const endTime = String(values.endTime ?? "");
  const errors = {
    weekday:
      weekday === null || !Number.isInteger(weekday) || weekday < 0 || weekday > 6
        ? "Choose a day"
        : null,
    startTime: TIME_RE.test(startTime) ? null : "Use a valid time (HH:MM)",
    endTime: TIME_RE.test(endTime) ? null : "Use a valid time (HH:MM)",
  };
  if (!errors.startTime && !errors.endTime && endTime <= startTime) {
    errors.endTime = "End time must be after start time";
  }
  return collect(errors);
}

export function validateProfile(values) {
  return collect({
    fullName: required("Full name", values.fullName, 2, 100),
    phone: optionalText(values.phone, 30),
  });
}
