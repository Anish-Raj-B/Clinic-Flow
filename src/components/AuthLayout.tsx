import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { APP_CONFIG } from '../lib/config';
import { Logo } from './Logo';
import { CheckIcon } from './icons';

const HIGHLIGHTS = [
  'Real-time availability with database-level double-booking protection',
  'Inventory alerts before you run out or items expire',
  'Invoices, PDFs and revenue analytics in one place',
];

/** Two-column authentication layout with the marketing panel. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-accent-700 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-accent-300/20 blur-3xl"
          aria-hidden="true"
        />
        <Link to="/" className="relative">
          <Logo className="[&_span:last-child]:text-white" size="lg" />
        </Link>
        <div className="relative max-w-lg">
          <h2 className="text-3xl font-bold leading-tight">
            Less paperwork. More time with patients.
          </h2>
          <p className="mt-3 text-brand-50/90">
            ClinicFlow keeps your schedule, stock and billing in sync so your team can focus on
            care.
          </p>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3 text-sm text-brand-50">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                {highlight}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-100/80">
          {APP_CONFIG.clinicName} · {APP_CONFIG.clinicAddress}
        </p>
      </div>

      <div className="flex min-h-screen flex-col justify-center px-4 py-10 sm:px-8 lg:min-h-0">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link to="/">
              <Logo size="lg" />
            </Link>
          </div>
          <div className="surface p-6 sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          {footer ? <div className="mt-6 text-center text-sm">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
