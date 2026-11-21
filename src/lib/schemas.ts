import { z } from 'zod';

/**
 * Client-side validation schemas. The same rules are enforced again by SQL
 * CHECK constraints / triggers. Forms use z.number() with valueAsNumber so the
 * resolver input and output types match.
 */

const trimmedRequired = (label: string, min = 1, max = 120) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .or(z.literal(''));

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a valid time (HH:MM)');

export const signInSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    fullName: trimmedRequired('Full name', 2, 100),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    phone: optionalText(30),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(72, 'Use at most 72 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type SignUpValues = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(72, 'Use at most 72 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

export const bookingSchema = z.object({
  serviceId: z.string().uuid('Choose a service'),
  staffId: z.string().uuid('Choose a staff member'),
  startsAt: z.string().min(1, 'Choose a time slot'),
  notes: optionalText(1000),
});
export type BookingValues = z.infer<typeof bookingSchema>;

export const serviceSchema = z.object({
  name: trimmedRequired('Service name', 2, 80),
  description: optionalText(1000),
  durationMinutes: z
    .number({ invalid_type_error: 'Enter a duration' })
    .int('Use whole minutes')
    .min(5, 'Minimum 5 minutes')
    .max(480, 'Maximum 480 minutes'),
  price: z
    .number({ invalid_type_error: 'Enter a price' })
    .min(0, 'Price cannot be negative')
    .max(1_000_000, 'Price is too large'),
  active: z.boolean(),
});
export type ServiceValues = z.infer<typeof serviceSchema>;

export const inventoryItemSchema = z.object({
  name: trimmedRequired('Item name', 2, 120),
  sku: trimmedRequired('SKU', 1, 60),
  category: optionalText(60),
  quantity: z
    .number({ invalid_type_error: 'Enter a quantity' })
    .int('Use whole units')
    .min(0, 'Quantity cannot be negative')
    .max(1_000_000, 'Quantity is too large'),
  reorderLevel: z
    .number({ invalid_type_error: 'Enter a reorder level' })
    .int('Use whole units')
    .min(0, 'Reorder level cannot be negative')
    .max(1_000_000, 'Reorder level is too large'),
  unitPrice: z
    .number({ invalid_type_error: 'Enter a unit price' })
    .min(0, 'Price cannot be negative')
    .max(1_000_000, 'Price is too large'),
  expiryDate: optionalText(10),
  supplier: optionalText(120),
});
export type InventoryItemValues = z.infer<typeof inventoryItemSchema>;

export const stockMovementSchema = z.object({
  direction: z.enum(['in', 'out']),
  amount: z
    .number({ invalid_type_error: 'Enter a quantity' })
    .int('Use whole units')
    .min(1, 'Quantity must be at least 1')
    .max(100_000, 'Quantity is too large'),
  reason: trimmedRequired('Reason', 3, 200),
});
export type StockMovementValues = z.infer<typeof stockMovementSchema>;

export const invoiceLineSchema = z.object({
  description: trimmedRequired('Description', 1, 200),
  quantity: z
    .number({ invalid_type_error: 'Enter a quantity' })
    .int('Use whole units')
    .min(1, 'At least 1')
    .max(10_000, 'Too many'),
  unitPrice: z
    .number({ invalid_type_error: 'Enter a price' })
    .min(0, 'Cannot be negative')
    .max(1_000_000, 'Too large'),
});

export const invoiceSchema = z.object({
  customerId: z.string().uuid('Choose a customer'),
  appointmentId: z.string().uuid().optional().or(z.literal('')),
  taxRate: z
    .number({ invalid_type_error: 'Enter a tax rate' })
    .min(0, 'Minimum 0%')
    .max(100, 'Maximum 100%'),
  items: z.array(invoiceLineSchema).min(1, 'Add at least one line item'),
});
export type InvoiceValues = z.infer<typeof invoiceSchema>;

export const availabilitySchema = z
  .object({
    weekday: z
      .number({ invalid_type_error: 'Choose a day' })
      .int()
      .min(0, 'Choose a day')
      .max(6, 'Choose a day'),
    startTime: timeString,
    endTime: timeString,
  })
  .refine((values) => values.endTime > values.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });
export type AvailabilityValues = z.infer<typeof availabilitySchema>;

export const profileSchema = z.object({
  fullName: trimmedRequired('Full name', 2, 100),
  phone: optionalText(30),
});
export type ProfileValues = z.infer<typeof profileSchema>;
