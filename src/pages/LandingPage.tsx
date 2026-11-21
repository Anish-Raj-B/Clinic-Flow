import { Link } from 'react-router-dom';
import { APP_CONFIG } from '../lib/config';
import { Logo } from '../components/Logo';
import { useThemeContext } from '../context/ThemeContext';
import {
  BoxIcon,
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  MailIcon,
  MapPinIcon,
  MoonIcon,
  PhoneIcon,
  ReceiptIcon,
  ShieldIcon,
  SparkleIcon,
  StethoscopeIcon,
  SunIcon,
  UsersIcon,
} from '../components/icons';

const FEATURES = [
  {
    icon: CalendarIcon,
    title: 'Conflict-free scheduling',
    description:
      'Live availability per practitioner, with a PostgreSQL exclusion constraint that makes double bookings impossible.',
  },
  {
    icon: BoxIcon,
    title: 'Inventory that warns you',
    description:
      'Track stock, reorder levels and expiry dates. Get badges, digests and a full movement history.',
  },
  {
    icon: ReceiptIcon,
    title: 'Billing without spreadsheets',
    description:
      'Create invoices from appointments, add line items, mark them paid and download a branded PDF.',
  },
  {
    icon: ChartIcon,
    title: 'Decisions from real data',
    description:
      'Daily revenue, busiest hours, top-selling items and no-show rate updated straight from your database.',
  },
  {
    icon: ShieldIcon,
    title: 'Role-aware security',
    description:
      'Row Level Security on every table. Customers only see their own records; every change is audited.',
  },
  {
    icon: MailIcon,
    title: 'Automated reminders',
    description:
      'Daily reminder emails, low-stock digests and booking confirmations delivered through Resend.',
  },
];

const STEPS = [
  {
    title: 'Set up your clinic',
    description: 'Add services, invite staff and set weekly availability in minutes.',
  },
  {
    title: 'Share your booking link',
    description: 'Customers pick a service, practitioner and a genuinely free slot.',
  },
  {
    title: 'Run the day',
    description: 'Update statuses, bill visits, restock inventory and watch the numbers.',
  },
];

export function LandingPage() {
  const { theme, toggleTheme } = useThemeContext();

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="ClinicFlow home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
            <a href="#features" className="transition hover:text-brand-600 dark:hover:text-brand-400">
              Features
            </a>
            <a href="#roles" className="transition hover:text-brand-600 dark:hover:text-brand-400">
              For your team
            </a>
            <a href="#how" className="transition hover:text-brand-600 dark:hover:text-brand-400">
              How it works
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <Link
              to="/login"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(56,151,246,0.16),transparent_70%)]"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
                <SparkleIcon className="h-3.5 w-3.5" />
                Built for small clinics &amp; pharmacies
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                Ditch the paper register.
                <span className="block text-brand-600 dark:text-brand-400">
                  Run your clinic from one place.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">
                ClinicFlow replaces notebooks and WhatsApp threads with real-time booking,
                inventory tracking, invoices and analytics. No double bookings. No surprise
                stock-outs.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400"
                >
                  Create your account
                  <ChevronRightIcon className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  Sign in to your clinic
                </Link>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Double bookings
                  </dt>
                  <dd className="mt-1 text-xl font-bold">0</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Record lookup
                  </dt>
                  <dd className="mt-1 text-xl font-bold">&lt;1s</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Setup time
                  </dt>
                  <dd className="mt-1 text-xl font-bold">Minutes</dd>
                </div>
              </dl>
            </div>

            {/* Schedule preview */}
            <div className="relative">
              <div
                className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-brand-200/60 to-accent-200/60 blur-2xl dark:from-brand-500/20 dark:to-accent-500/20"
                aria-hidden="true"
              />
              <div className="relative surface overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-semibold">Today&apos;s schedule</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {APP_CONFIG.clinicName}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
                  </span>
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[
                    { time: '09:00', name: 'Amina Yusuf', service: 'General consultation', tone: 'bg-brand-500' },
                    { time: '09:30', name: 'Daniel Okafor', service: 'Blood pressure check', tone: 'bg-accent-500' },
                    { time: '10:15', name: 'Priya Sharma', service: 'Vaccination', tone: 'bg-amber-500' },
                    { time: '11:00', name: 'Luis Alvarez', service: 'Follow-up visit', tone: 'bg-brand-500' },
                  ].map((row) => (
                    <li key={row.time} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex w-14 flex-col text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span>{row.time}</span>
                        <span className="font-normal text-slate-400">30 min</span>
                      </div>
                      <span className={`h-9 w-1 rounded-full ${row.tone}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{row.name}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {row.service}
                        </p>
                      </div>
                      <span className="hidden rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 sm:inline dark:bg-brand-500/10 dark:text-brand-300">
                        Confirmed
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="grid grid-cols-2 gap-3 border-t border-slate-200 p-5 dark:border-slate-800">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <ClockIcon className="h-3.5 w-3.5" /> Next up
                    </p>
                    <p className="mt-1 text-sm font-semibold">09:00 · Amina Yusuf</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-500/10">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                      <BoxIcon className="h-3.5 w-3.5" /> Low stock
                    </p>
                    <p className="mt-1 text-sm font-semibold text-amber-900 dark:text-amber-200">
                      2 items need reorder
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              Everything in one workspace
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Built for the way small clinics actually work
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              No enterprise bloat. Just the workflows that keep your day running and your records
              safe.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="surface p-6 transition hover:shadow-lg">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="border-y border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight">One system, three clear roles</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-300">
                Everyone sees exactly what they need. Permissions are enforced in the database, not
                just the interface.
              </p>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: UsersIcon,
                  role: 'Customers',
                  points: ['Book and cancel appointments', 'See live free slots', 'Download their invoices'],
                },
                {
                  icon: StethoscopeIcon,
                  role: 'Staff',
                  points: ['Today\'s schedule and status updates', 'Inventory CRUD and stock movements', 'Create invoices and take payment'],
                },
                {
                  icon: ShieldIcon,
                  role: 'Owners',
                  points: ['Manage services and staff roles', 'Revenue and no-show analytics', 'Full audit log access'],
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.role} className="surface p-6">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold">{item.role}</h3>
                    <ul className="mt-3 space-y-2">
                      {item.points.map((point) => (
                        <li key={point} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-400" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
            <div className="max-w-md">
              <h2 className="text-3xl font-bold tracking-tight">From paper to ClinicFlow in an afternoon</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-300">
                Invite your team, import your stock list and let customers book online. Your first
                week is usually the hardest - after that it runs itself.
              </p>
              <div className="mt-6 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <p className="flex items-center gap-2">
                  <MapPinIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  Works on clinic desktops, tablets and phones
                </p>
                <p className="flex items-center gap-2">
                  <PhoneIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  {APP_CONFIG.clinicPhone}
                </p>
              </div>
            </div>
            <ol className="grid flex-1 gap-4 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="surface p-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white dark:bg-brand-500">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-700 to-accent-700 px-6 py-12 text-white sm:px-12">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl"
              aria-hidden="true"
            />
            <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-2xl font-bold sm:text-3xl">Ready to see your schedule clearly?</h2>
                <p className="mt-2 max-w-xl text-brand-50/90">
                  Create an account as a customer, or ask your clinic owner for a staff role.
                </p>
              </div>
              <Link
                to="/signup"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-800 shadow-sm transition hover:bg-brand-50"
              >
                Get started free
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <Logo size="sm" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} ClinicFlow. Appointment &amp; inventory management for
            small clinics.
          </p>
          <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400">
            <Link to="/login" className="hover:text-brand-600 dark:hover:text-brand-400">
              Log in
            </Link>
            <Link to="/signup" className="hover:text-brand-600 dark:hover:text-brand-400">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
