import type { ReactNode } from 'react';
import type { AppointmentStatus, InvoiceStatus, UserRole } from '../../types/database';
import {
  APPOINTMENT_STATUS_CLASSES,
  APPOINTMENT_STATUS_LABELS,
  INVOICE_STATUS_CLASSES,
  INVOICE_STATUS_LABELS,
  ROLE_LABELS,
  cn,
} from '../../lib/utils';

type BadgeTone = 'brand' | 'accent' | 'amber' | 'rose' | 'slate' | 'emerald';

const TONE_CLASSES: Record<BadgeTone, string> = {
  brand: 'bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300',
  accent: 'bg-accent-100 text-accent-800 dark:bg-accent-500/15 dark:text-accent-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  rose: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  slate: 'bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300',
  emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
};

export function Badge({
  children,
  tone = 'slate',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        APPOINTMENT_STATUS_CLASSES[status],
      )}
    >
      {APPOINTMENT_STATUS_LABELS[status]}
    </span>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        INVOICE_STATUS_CLASSES[status],
      )}
    >
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  const tone: BadgeTone = role === 'owner' ? 'accent' : role === 'staff' ? 'brand' : 'slate';
  return <Badge tone={tone}>{ROLE_LABELS[role]}</Badge>;
}
