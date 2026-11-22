# ClinicFlow

Appointment, inventory, billing and analytics for small clinics, pharmacies and local service
businesses. ClinicFlow replaces the paper register and WhatsApp threads with a single, role-aware
workspace where double bookings are impossible at the database level.

**This repository has been migrated off React/Vite/TypeScript/Tailwind onto the required stack.
The application behaviour, pages, workflows, validation, security model and database are
unchanged.**

| Layer | Before | After |
| --- | --- | --- |
| Structure | React JSX | **HTML5** (`frontend/index.html`, HTML templates in JS modules) |
| Styling | Tailwind CSS + PostCSS | **CSS3** (`frontend/css/styles.css`, same palette and layout) |
| Frontend logic | React 18 + TypeScript + React Router + React Hook Form + Zod + Recharts | **Vanilla JavaScript ES modules** (native History API router, hand-written validation, SVG charts) |
| Backend | Supabase Edge Functions (Deno/TypeScript) | **Python 3.11 + FastAPI** (`backend/`) |
| Build system | Vite, npm, TypeScript compiler | **None** — static files are served directly |
| Database/Auth/Storage | Supabase | **Supabase (unchanged)** — same tables, RLS, RPCs, triggers, views |
| PDF | jsPDF + jspdf-autotable | jsPDF + jspdf-autotable (vendored locally, called from vanilla JS) |

No frontend framework, bundler or npm dependency remains. The only vendored JavaScript libraries are
the Supabase browser SDK and jsPDF (needed for the existing PDF invoices); both live in
`frontend/js/vendor/` and are loaded with plain `<script>` tags.

---

## Contents

1. [Feature parity report](#feature-parity-report)
2. [Architecture](#architecture)
3. [Project structure](#project-structure)
4. [Local development](#local-development)
5. [Environment variables](#environment-variables)
6. [Database and security model](#database-and-security-model)
7. [Python backend API](#python-backend-api)
8. [Email and scheduled jobs](#email-and-scheduled-jobs)
9. [Deployment](#deployment)
10. [Tests and results](#tests-and-results)
11. [Migration notes](#migration-notes)
12. [Security notes and limitations](#security-notes-and-limitations)
13. [Manual steps you must do yourself](#manual-steps-you-must-do-yourself)

---

## Feature parity report

Every feature from the original React application was ported. "Ported" means the same UI, copy,
validation, database calls and error handling are present in the new stack.

| # | Feature | Original location | New location | Status |
| --- | --- | --- | --- | --- |
| 1 | Marketing landing page (hero, features, roles, steps, CTA, footer, dark-mode toggle) | `pages/LandingPage.tsx` | `frontend/js/pages/landing.js` | ✅ Ported |
| 2 | Sign up (name, email, phone, password rules, confirmation state) | `pages/SignupPage.tsx` | `pages/auth.js` → `renderSignup` | ✅ Ported |
| 3 | Sign in (redirect back to requested page) | `pages/LoginPage.tsx` | `renderLogin` | ✅ Ported |
| 4 | Forgot password (sent state, change email) | `pages/ForgotPasswordPage.tsx` | `renderForgotPassword` | ✅ Ported |
| 5 | Reset password (requires recovery session) | `pages/ResetPasswordPage.tsx` | `renderResetPassword` | ✅ Ported |
| 6 | Guest-only routes and authenticated redirects | `components/guards.tsx` | `router.js` (`guest`, `app`, `roles`) | ✅ Ported |
| 7 | Profile-missing recovery screen (refresh / sign out) | `guards.tsx` | `router.js` + `pages/auth.js` | ✅ Ported |
| 8 | Role-aware app shell: sidebar groups, active link, mobile drawer, topbar, sign-out, footer | `components/AppShell.tsx` | `layout.js` | ✅ Ported |
| 9 | Role-aware home redirect (`/app` → book or dashboard) | `pages/HomeRedirect.tsx` | `router.js` | ✅ Ported |
| 10 | 404 page | `pages/NotFoundPage.tsx` | `renderNotFound` | ✅ Ported |
| 11 | Dark mode with `localStorage` persistence, system default | `hooks/useTheme.ts` | `store.js` (`initTheme`, `toggleTheme`) | ✅ Ported |
| 12 | Toast notifications (success / error / info, auto-dismiss, dismiss button) | `context/ToastContext.tsx` | `store.js` (`toast`) | ✅ Ported |
| 13 | Accessible modal dialogs (Esc, backdrop, focus, scroll lock) | `components/ui/Modal.tsx` | `components.js` (`openModal`) | ✅ Ported |
| 14 | Form field components with label/hint/error + ARIA wiring | `components/ui/Field.tsx` | `components.js` (`inputField`, `selectField`, `textareaField`) | ✅ Ported |
| 15 | Client validation for every form (same messages as Zod) | `lib/schemas.ts` | `validation.js` | ✅ Ported |
| 16 | Customer booking: services, practitioners, 21-day strip, live slots via `get_available_slots`, morning/afternoon/evening groups, notes counter, summary, `book_appointment` RPC, confirmation email call, friendly constraint errors | `pages/customer/BookAppointmentPage.tsx` | `pages/customer.js` → `renderBookAppointment` | ✅ Ported |
| 17 | Customer appointments: upcoming/history split, status badges, cancel modal + `cancel_appointment` RPC | `MyAppointmentsPage.tsx` | `renderMyAppointments` | ✅ Ported |
| 18 | Customer invoices: list, detail modal, line items, totals, PDF download | `MyInvoicesPage.tsx` | `renderMyInvoices` + `pdf.js` | ✅ Ported |
| 19 | Staff dashboard: today's schedule, four stat cards, low-stock and expiry alerts | `pages/staff/DashboardPage.tsx` | `pages/staff.js` → `renderDashboard` | ✅ Ported |
| 20 | Staff appointments: date range, status and practitioner filters, grouped by day, inline status update, reset filters | `AppointmentsPage.tsx` | `renderAppointments` | ✅ Ported |
| 21 | Inventory: search + category filter, add/edit/delete item, stock movements, low/out/expiry badges, CSV export | `InventoryPage.tsx` | `renderInventory` | ✅ Ported |
| 22 | Billing: invoice list, status + search filter, collected total, create invoice with line items and live totals, appointment autofill, mark paid, PDF | `BillingPage.tsx` | `renderBilling` | ✅ Ported |
| 23 | Owner services: CRUD, activate/deactivate, delete guard for FK-bound services | `pages/owner/ServicesPage.tsx` | `pages/owner.js` → `renderServices` | ✅ Ported |
| 24 | Owner staff & roles: search, role change (self disabled), weekly availability add/remove | `StaffPage.tsx` | `renderStaff` | ✅ Ported |
| 25 | Analytics: 30-day revenue, appointments, no-show rate, average invoice, daily revenue chart, busiest hours chart, top items | `AnalyticsPage.tsx` | `renderAnalytics` + `charts.js` | ✅ Ported (SVG charts replace Recharts) |
| 26 | Audit logs: table/action filters, insert/update/delete summary, expandable JSON | `AuditLogsPage.tsx` | `renderAuditLogs` | ✅ Ported |
| 27 | Invoice PDF with clinic header, table, totals, footer | `lib/pdf.ts` | `frontend/js/pdf.js` | ✅ Ported |
| 28 | Booking confirmation email | Edge Function | `POST /api/notifications/booking-confirmation` | ✅ Ported |
| 29 | Daily reminder email job | Edge Function | `POST /api/jobs/send-reminders` | ✅ Ported |
| 30 | Weekly low-stock/expiry digest | Edge Function | `POST /api/jobs/send-low-stock-alert` | ✅ Ported |
| 31 | Booking rate limit, double-booking exclusion, RLS, role guards, audit triggers | SQL | **Untouched** | ✅ Preserved |
| 32 | Seed data, demo accounts, email templates | `supabase/` | **Untouched** | ✅ Preserved |

Nothing was replaced with a placeholder. The only intentional implementation changes are listed in
[Migration notes](#migration-notes).

---

## Architecture

```
Browser
  ├── HTML5 pages + CSS3 + vanilla JS ES modules  (frontend/)
  │     ├── Supabase browser SDK (anon key + user JWT) → Auth / PostgREST / RPC
  │     ├── jsPDF + autotable → invoice PDFs (client-side, unchanged)
  │     └── fetch → Python backend for confirmation emails
  │
Python backend (FastAPI)
  ├── serves the static frontend and SPA fallback
  ├── /api/config.js        public config (anon key, branding) — no secrets
  ├── /api/health           readiness + configuration flags
  ├── /api/notifications/*  verifies the caller JWT with RLS before sending
  └── /api/jobs/*           service-role authenticated scheduled emails

Supabase Postgres
  ├── tables, enums, CHECK constraints, generated totals
  ├── RLS policies, SECURITY DEFINER role helpers
  ├── book_appointment / cancel_appointment / create_invoice RPCs
  ├── GiST exclusion constraint (no double bookings)
  ├── audit triggers, inventory movement trigger
  └── reporting views (security_invoker)
```

Double-booking protection is still not a UI convention: `appointments_no_staff_overlap` is a GiST
exclusion constraint over `(staff_id, tstzrange(starts_at, ends_at))` for non-cancelled rows, so two
concurrent requests cannot both succeed.

---

## Project structure

```
clinicflow/
├── README.md
├── .env.example                  backend + public configuration template
├── .gitignore
├── frontend/                     HTML5 + CSS3 + vanilla JS (no build step)
│   ├── index.html                single HTML entry point
│   ├── assets/favicon.svg
│   ├── css/
│   │   └── styles.css            design system, components, dark mode, responsive rules
│   └── js/
│       ├── app.js                bootstrap (theme → auth → router)
│       ├── router.js             routes, guards, SPA links, redirects
│       ├── layout.js             app shell + auth layout
│       ├── store.js              auth state, theme, toasts
│       ├── supabase.js           browser client (anon key only)
│       ├── config.js             runtime config from /api/config.js
│       ├── api.js                all Supabase queries/RPCs in one place
│       ├── components.js         buttons, fields, cards, badges, modals, loaders
│       ├── icons.js              inline SVG icon set
│       ├── validation.js         form validation (Zod parity)
│       ├── utils.js              dates, money, CSV, errors, display maps
│       ├── slots.js              pure slot helpers
│       ├── pdf.js                invoice PDF generator
│       ├── charts.js             SVG line/bar charts with tooltips
│       ├── vendor/               supabase.js, jspdf.umd.min.js, autotable plugin
│       └── pages/
│           ├── landing.js
│           ├── auth.js           login, signup, forgot, reset, 404
│           ├── customer.js       book, my appointments, my invoices
│           ├── staff.js          dashboard, appointments, inventory, billing
│           └── owner.js          services, staff, analytics, audit logs
├── backend/
│   ├── run.py                    dev entry point (uvicorn --reload)
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py               FastAPI app, security headers, static + SPA hosting
│   │   ├── config.py             environment settings
│   │   ├── supabase_rest.py      httpx client (PostgREST + GoTrue)
│   │   ├── email.py              Resend sender + escaped HTML templates
│   │   ├── security.py           JWT / service-role authentication
│   │   └── routes/
│   │       ├── meta.py           /api/health, /api/config, /api/config.js
│   │       ├── notifications.py  booking confirmation
│   │       └── jobs.py           reminders + low-stock digest
│   └── tests/                    pytest suite (13 tests)
├── tests/js/                     node:test suite for slots/utils/validation (33 tests)
└── supabase/
    ├── config.toml               local CLI config (auth redirects → :8000)
    ├── seed.sql                  demo users/services/stock/appointments/invoices
    ├── templates/                confirmation + recovery email HTML
    └── migrations/
        ├── 20260101000000_extensions_and_types.sql
        ├── 20260101000100_core_tables.sql
        ├── 20260101000200_functions_and_triggers.sql
        ├── 20260101000300_rls_policies.sql
        ├── 20260101000400_views.sql
        ├── 20260101000500_cron_schedules.sql
        └── 20260102000000_cron_python_backend.sql   ← new, additive, optional
```

---

## Local development

Prerequisites:

- **Python 3.11+**
- **Docker Desktop** and the **Supabase CLI** (`npm install -g supabase` or `scoop install supabase`)
  for the local database
- **No Node.js/npm is required** to run the application. Node **22+** is only used for the optional
  JavaScript unit tests (`node --test`); there is no `package.json`, so the tests rely on Node's
  automatic ES-module detection.

```bash
# 1. Python environment
cd backend
python -m venv .venv
# Windows (Git Bash):
./.venv/Scripts/python.exe -m pip install -r requirements.txt
# macOS/Linux:
# .venv/bin/pip install -r requirements.txt
cd ..

# 2. Start the local Supabase stack (Postgres, Auth, Studio, Inbucket)
supabase start

# 3. Apply migrations + seed data to the LOCAL database
#    (destroys and recreates only the local docker database)
supabase db reset

# 4. Configure the backend
cp .env.example .env
#    Read the URL and anon key from `supabase status` and fill in:
#      SUPABASE_URL=http://127.0.0.1:54321
#      SUPABASE_ANON_KEY=<anon key>
#      SUPABASE_SERVICE_ROLE_KEY=<service_role key>
#    Resend is optional locally (leave RESEND_API_KEY empty to disable email).

# 5. Run the app (serves the SPA and the API on one origin)
python backend/run.py            # http://localhost:8000
```

The app is available at <http://localhost:8000>. `supabase/config.toml` already lists
`http://localhost:8000/login` and `/reset-password` as allowed redirect URLs.

Useful commands:

```bash
supabase status                                        # local URLs and keys
supabase db diff                                       # schema drift
python -m pytest backend/tests -q                      # backend tests
node --test tests/js/*.test.mjs                        # JS unit tests
curl http://localhost:8000/api/health                  # readiness + config flags
```

### Demo accounts (from `seed.sql`)

| Email | Password | Role |
| --- | --- | --- |
| `owner@clinicflow.dev` | `ClinicFlow123!` | owner |
| `staff@clinicflow.dev` | `ClinicFlow123!` | staff |
| `nurse@clinicflow.dev` | `ClinicFlow123!` | staff |
| `customer@clinicflow.dev` | `ClinicFlow123!` | customer |
| `patient@clinicflow.dev` | `ClinicFlow123!` | customer |

Delete or change these accounts before using the project with real data.

---

## Environment variables

All variables are read by the Python backend from `.env`. The browser only receives the public
subset through `/api/config.js`.

| Variable | Required | Public? | Purpose |
| --- | --- | --- | --- |
| `SUPABASE_URL` | yes | yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | yes | yes | Public anon key (safe for browsers) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes for email/jobs | **no** | Server-side reads and auth email lookup |
| `RESEND_API_KEY` | for email | **no** | Resend API authentication |
| `RESEND_FROM_EMAIL` | recommended | no | Verified sender |
| `CLINIC_NAME` | no | yes | Shell, PDF and email branding |
| `CLINIC_ADDRESS` | no | yes | PDF/email header |
| `CLINIC_PHONE` | no | yes | PDF/email header |
| `CLINIC_EMAIL` | no | yes | PDF/email header |
| `CLINIC_CURRENCY` | no | yes | ISO currency code, default `USD` |
| `CLINIC_TIMEZONE` | no | yes | IANA zone used for display and emails |
| `HOST` / `PORT` | no | no | Bind address, default `127.0.0.1:8000` |
| `APP_ORIGIN` | no | no | CORS/auth origin, default `http://localhost:8000` |
| `API_BASE_URL` | no | yes | Absolute backend URL if frontend is hosted elsewhere |

> **Never** commit `.env`, and never expose `SUPABASE_SERVICE_ROLE_KEY` or `RESEND_API_KEY` to the
> browser. `/api/config.js` is generated from an explicit allow-list (`Settings.public_config`).

---

## Database and security model

The Supabase schema is **unchanged**. No table, column, constraint, policy, function, trigger, view or
row was modified by this migration.

### Existing migrations (apply in filename order)

1. **Extensions and types** — `pgcrypto`, `btree_gist`, `pg_cron`, `pg_net`; `user_role`,
   `appointment_status`, `invoice_status`.
2. **Core tables** — `profiles`, `services`, `staff_availability`, `appointments`,
   `inventory_items`, `inventory_movements`, `invoices`, `invoice_items`, `audit_logs`, indexes and
   CHECK constraints.
3. **Functions and triggers** — profile bootstrap, role guard, customer-cancel guard, slot
   generation, booking RPC with rate limiting, cancellation RPC, atomic invoice RPC, stock
   movements, audit trail.
4. **RLS policies** — RLS enabled on every table with explicit per-role policies.
5. **Views** — `low_stock_items`, `expiring_soon_items`, `daily_revenue`, `busiest_hours`
   (`security_invoker = true`).
6. **Cron schedules** — legacy `schedule_clinicflow_jobs()` calling Edge Functions.

### New migration (additive, not applied automatically)

`supabase/migrations/20260102000000_cron_python_backend.sql` **only adds a function**
`schedule_clinicflow_backend_jobs(base_url)`. It does not alter data or existing objects. It lets
pg_cron call the Python job endpoints instead of the removed Edge Functions. See
[Email and scheduled jobs](#email-and-scheduled-jobs).

### Key rules preserved

- `get_my_role()` is `SECURITY DEFINER` with `set search_path = public, pg_temp` and is the only role
  helper used by policies, preventing RLS recursion on `profiles`.
- Customers read/insert (pending only)/cancel their own appointments and read their own invoices and
  invoice items. Staff and owners see clinic-wide records. Only owners manage services, availability,
  roles, analytics and audit logs.
- `guard_profile_role_change` blocks self-promotion even if a policy were misconfigured.
- `book_appointment()` enforces: authenticated user, future date, ≤ 90 days ahead, active service,
  valid practitioner, max **5 bookings per customer per rolling hour**, and the time must be
  returned by `get_available_slots()`. The exclusion constraint is the final race guard.
- `inventory_movements` is append-only; inserting a movement updates stock atomically and raises if
  the result would be negative.
- Every change to appointments, inventory items, invoices and `profiles.role` writes to
  `audit_logs` through a `SECURITY DEFINER` trigger.
- `total` and `line_total` are generated columns, so invoice math cannot drift.
- Client validation mirrors the SQL CHECK constraints; the database remains authoritative.

### Clinic timezone

Weekly availability is stored as wall-clock times. Slot generation and reporting interpret them in
the timezone returned by `public.clinic_timezone()`, which reads the `clinicflow.timezone` setting and
falls back to `UTC`.

```sql
alter database postgres set clinicflow.timezone = 'Europe/London';
select pg_reload_conf();
```

Set `CLINIC_TIMEZONE` to the **same** zone so displayed times match bookable slots.

---

## Python backend API

| Method | Path | Auth | Purpose | Success response |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | none | Readiness + which secrets are configured | `{status, supabase_configured, admin_configured, email_configured}` |
| GET | `/api/config` | none | Public config JSON | `{SUPABASE_URL, SUPABASE_ANON_KEY, CLINIC_*}` |
| GET | `/api/config.js` | none | Same config as `window.__CLINICFLOW_CONFIG__` | JavaScript |
| POST | `/api/notifications/booking-confirmation` | user JWT | Booking confirmation email; RLS decides visibility first | `{sent: true}` / `{sent:false, reason}` |
| POST | `/api/jobs/send-reminders` | `Bearer <service_role_key>` | Reminders for pending/confirmed visits in the next 24 h | `{checked, sent, skipped, failures}` |
| POST | `/api/jobs/send-low-stock-alert` | `Bearer <service_role_key>` | Weekly digest to all owners | `{low_stock, expiring, owners, sent, failures}` |
| GET | `/api/docs` | none | Interactive OpenAPI docs (development aid) | Swagger UI |
| GET | `/*` | none | Static assets, SPA fallback to `index.html` | HTML/CSS/JS |

The backend never writes application data directly: all mutations still go through Supabase PostgREST
or RPCs from the browser, under RLS. The service role is used only for auth-email lookups and the two
scheduled digests.

---

## Email and scheduled jobs

Email is sent through Resend, exactly as before, with the same templates and escaping.

| Job | Trigger | Auth check |
| --- | --- | --- |
| Booking confirmation | Browser calls the backend after a successful booking (best effort) | Caller's JWT is validated and the appointment must be visible under RLS |
| Daily reminders | pg_cron, 08:00 UTC | `Authorization: Bearer <service_role_key>` |
| Weekly low-stock digest | pg_cron, Mondays 07:00 UTC | `Authorization: Bearer <service_role_key>` |

Set secrets in `.env` on the backend host:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL="ClinicFlow <no-reply@yourclinic.com>"
CLINIC_NAME="Your Clinic"
CLINIC_TIMEZONE="Europe/London"
CLINIC_CURRENCY="GBP"
```

### Scheduling against the Python backend

1. Store the service role key in **Project Settings → Vault → `service_role_key`**.
2. Apply the new migration (`supabase db push`, or paste the SQL in the SQL editor).
3. Run once, with your deployed backend URL:

```sql
select public.schedule_clinicflow_backend_jobs('https://your-api.example.com');
select jobid, jobname, schedule, active from cron.job;
```

To unschedule: `select public.schedule_clinicflow_backend_jobs('');`.

Manual test of a deployed job:

```bash
curl -i -X POST "https://your-api.example.com/api/jobs/send-reminders" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected `200` and `{ "checked": n, "sent": n, ... }`; `401` means the header is not exactly the
service role key.

---

## Deployment

The backend is a long-running Python process, so it needs a host that runs Python — for example
Render, Railway, Fly.io, a VPS with systemd, or a container platform. Static hosting alone
(Cloudflare Pages, GitHub Pages) cannot run FastAPI. The application is designed so the backend
serves both the API and the static frontend on one origin, which keeps CORS, CSP and Supabase auth
redirects simple.

### A. Supabase

1. Create a project, note the URL, anon key and service role key.
2. From **Project Settings → API**, copy the three values into the backend environment.
3. Push the schema (or run the migration files in the SQL editor in filename order):
   `supabase link --project-ref <ref> && supabase db push`.
4. Set the clinic timezone:
   ```sql
   alter database postgres set clinicflow.timezone = 'Europe/London';
   select pg_reload_conf();
   ```
5. **Authentication → Providers → Email**: enable Email and confirmation.
6. **Authentication → URL Configuration**:
   - Site URL: `https://your-api.example.com`
   - Redirect URLs: `https://your-api.example.com/login`,
     `https://your-api.example.com/reset-password`.
7. Create the first owner:
   ```sql
   update public.profiles set role = 'owner'
   where id = (select id from auth.users where email = 'you@yourclinic.com');
   ```

### B. Python backend

```bash
# Any Python 3.11+ host
python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
# Provide .env (never commit it), then:
.venv/bin/python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

Health check: `GET /api/health` must return `supabase_configured: true` (and
`admin_configured: true` for email jobs).

Example `systemd` unit:

```ini
[Unit]
Description=ClinicFlow
After=network.target

[Service]
WorkingDirectory=/srv/clinicflow
EnvironmentFile=/srv/clinicflow/.env
ExecStart=/srv/clinicflow/.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Put a TLS reverse proxy (Caddy, nginx, the platform's router) in front. The app sends HSTS,
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
`Permissions-Policy` and a strict CSP with `connect-src` automatically allowed for your Supabase
project.

### C. Reverse-proxy note

The SPA uses real paths (`/app/dashboard`). The FastAPI catch-all already serves `index.html` for
unknown paths, so no extra rewrite rule is required. If you front it with nginx, forward all requests
to the Python process rather than serving `frontend/` directly (otherwise deep links 404).

---

## Tests and results

Run the suites:

```bash
# JavaScript unit tests (Node 22+, no dependencies)
node --test tests/js/*.test.mjs

# Python backend tests (FastAPI TestClient)
python -m pytest backend/tests -q
```

### Actual results in this workspace

| Suite | Command | Result |
| --- | --- | --- |
| JavaScript unit tests | `node --test tests/js/*.test.mjs` | **33 passing, 0 failing** |
| Python backend tests | `python -m pytest backend/tests -q` | **13 passing, 0 failing** |

Coverage:

- JS: slot generation/overlap/partitioning, invoice math and rounding, clinic-timezone date helpers,
  CSV escaping, invoice numbering, error mapping, and all ten validation validators (parity with the
  old Zod messages).
- Python: HTML escaping, email layout/branding, date/money/timezone formatting, `/api/health`,
  `/api/config` secret allow-list, `/api/config.js` content type and globals, service-role enforcement
  on both jobs, booking-confirmation authentication, security headers, SPA fallback, static assets.

### What was *not* exercised

No Supabase credentials are configured in this workspace, so the following were **not** run against
a live database and are **not claimed as tested**:

- Signup/login/password reset against Supabase Auth
- Booking, cancellation, invoice RPCs and RLS enforcement with real users
- Email delivery through Resend
- pg_cron → Python job execution

The database-facing code paths are unchanged from the original implementation (same tables, RPCs,
select strings and RLS), and the frontend was exercised in a browser for rendering and navigation.
To verify end-to-end, follow [Local development](#local-development) with `supabase start` and the
demo accounts, then run the post-deploy checklist below.

### Suggested end-to-end checklist (with a live Supabase project)

**Roles and routing**

- [ ] Sign up → lands in the customer booking flow; `/app/dashboard` redirects back.
- [ ] Owner promotes the user in **Staff & roles** → after refresh the staff nav appears.
- [ ] Owner cannot change their own role; customer cannot open `/app/analytics`.

**Booking and double booking**

- [ ] Customer books → appointment appears as `pending`; confirmation email arrives.
- [ ] Two windows booking the same practitioner/time → second gets "That slot was just booked…".
- [ ] Booking 6 times in an hour returns the rate-limit message.
- [ ] Customer cancels → the slot becomes available again.
- [ ] Owner deactivates a service → it disappears from the booking step.

**RLS**

- [ ] Customer A's session: `select` on `appointments` returns only A's rows.
- [ ] Customer A cannot update their own `profiles.role`.
- [ ] Anonymous client sees no invoices.
- [ ] A customer reading `daily_revenue` sees at most their own paid invoices.

**Operations**

- [ ] Inventory add / stock in / stock out / CSV export.
- [ ] Low-stock and expiring views populate the dashboard.
- [ ] Billing: create from appointment, totals correct, mark paid, PDF downloads.
- [ ] Audit log records appointment, invoice and role changes.
- [ ] Forgot password → email link → `/reset-password` → new password works.
- [ ] Dark-mode toggle and mobile layout (≤ 400 px) are usable.
- [ ] `select * from cron.job;` lists both jobs after scheduling.

---

## Migration notes

### What was replaced, and why it is equivalent

- **React components → HTML templates.** Each page module returns an HTML string plus a `mount()`
  function that binds events with `addEventListener`. State lives in small closures; no virtual DOM.
- **React Router → History API router.** Same paths, same guard semantics (`app`, `guest`, `roles`),
  same `?next=` redirect-back behaviour, delegated SPA link handling, 404 fallback.
- **Contexts → `store.js`.** One auth store with subscriptions, one theme applier, one toast stack.
  Supabase `onAuthStateChange` and profile retry logic are preserved verbatim.
- **Tailwind → `styles.css`.** A hand-written component layer (`.btn`, `.card`, `.field`, `.badge`,
  `.table`, `.modal`, `.app-layout`, landing sections) with the original brand (`#2278eb`) and accent
  (`#14b596`) palette, radii, shadows and class-based dark mode. Responsive breakpoints mirror the
  original (`640`, `768`, `1024`, `1200`, ≤ 420 px).
- **Zod → `validation.js`.** Same rules and the exact same user-facing messages, including invoice
  line-item errors and availability time ordering.
- **Recharts → `charts.js`.** Dependency-free SVG line and bar charts with axes, grid lines, hover
  tooltips and the same data/colours. This is the only visual implementation difference; the data and
  labels are identical.
- **React Hook Form → plain FormData + validators.** Loading states, ARIA invalid flags and error
  slots behave the same.
- **Deno Edge Functions → FastAPI endpoints.** The RLS-visibility-first check for booking
  confirmations, service-role authentication for jobs, Resend payloads, subjects and HTML bodies are
  ported line for line.

### Deliberate, documented differences

1. **Charts are SVG instead of Recharts.** Recharts is a React-only library; drawing the same line and
   bar charts with SVG keeps the UI and data while removing the framework dependency.
2. **The frontend is served by FastAPI instead of a CDN static host.** A Python backend is required by
   the target stack; serving the static SPA from it keeps one origin.
3. **Configuration is delivered at runtime** (`/api/config.js`) instead of being inlined by Vite.
   This is required without a bundler and is safer: the allow-list cannot leak a service key.
4. **The legacy Edge Functions were removed** (`supabase/functions/`), because the stack must not
   contain Deno/TypeScript server code. Their behaviour lives in `backend/app/routes/`.
5. **The old `public/_headers` / `_redirects` files were removed**; the same headers and SPA fallback
   are now applied by FastAPI (`backend/app/main.py`).
6. **`supabase/config.toml` auth URLs moved from port 5173 to 8000.** This is local development
   configuration only; it does not touch the remote database.

### What was explicitly preserved

- All tables, columns, enums, CHECK constraints, foreign keys, indexes, generated columns.
- The GiST exclusion constraint and booking rate limit.
- All RLS policies and grants.
- All SQL functions, triggers and views.
- Seed data and demo accounts.
- Supabase Auth usage (email/password, confirmation, recovery, PKCE, session persistence).
- Storage configuration in `supabase/config.toml` (the app does not use storage buckets).
- Every form field, validation message, toast, modal, badge and table column.
- The invoice PDF layout and clinic branding.
- Resend email subjects and HTML structure.

---

## Security notes and limitations

**Security**

- RLS is enabled on every table, including `audit_logs`; there are no "allow all" policies.
- The browser only holds the anon key and the user's JWT. The service role key exists only in the
  Python process.
- `/api/config.js` is generated from an explicit allow-list; a test asserts the service key never
  appears.
- The booking-confirmation endpoint validates the user's JWT and then re-reads the appointment with
  that JWT (RLS) before using the service role.
- Job endpoints compare the bearer token to the service role key in constant time.
- All user text is escaped (`escapeHtml`) before it reaches HTML or email templates; no
  `innerHTML` receives unescaped user data.
- Security headers (CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`) are applied to every response.
- Booking is rate-limited in the database (5/hour/customer).

**Intentional limitations (unchanged from the original)**

- One clinic per deployment (single-tenant).
- Staff schedule new appointments only through the customer flow.
- Invoices are one-off documents; no payment gateway (mark-as-paid only).
- Reminder and digest schedules are fixed in SQL; adjust the cron expressions and redeploy.
- The SPA is client-rendered; there is no server-side rendering.

**Operational notes**

- The frontend uses ES modules with relative imports, so it must be served over HTTP (not
  `file://`).
- Realtime subscriptions were not part of the original app and were not added.

---

## Manual steps you must do yourself

These cannot be automated from the repository:

| # | Task | Where |
| --- | --- | --- |
| 1 | Create the Supabase project and copy URL + anon + service role keys | Supabase Dashboard |
| 2 | `supabase login`, `supabase link`, `supabase db push` (or run migrations in SQL Editor) | CLI / SQL Editor |
| 3 | Set `clinicflow.timezone` and `pg_reload_conf()` | SQL Editor |
| 4 | Enable Email auth, set Site URL + redirect URLs (`/login`, `/reset-password`) | Authentication settings |
| 5 | Sign up and promote the first owner via SQL | SQL Editor |
| 6 | Create a Resend account, verify sending domain, create API key | resend.com |
| 7 | Put `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in the backend `.env` | Server environment |
| 8 | Deploy the Python backend and confirm `/api/health` | Python host |
| 9 | Add Vault secret `service_role_key`, run `schedule_clinicflow_backend_jobs(url)` | SQL Editor |
| 10 | Point your domain/TLS proxy at the backend | DNS / proxy |
| 11 | Rotate/delete the seeded demo accounts before going live | Supabase / app |
| 12 | Complete the end-to-end checklist above | Browser + SQL |
