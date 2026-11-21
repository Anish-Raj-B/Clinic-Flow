# ClinicFlow

Appointment, inventory, billing and analytics for small clinics, pharmacies and local service
businesses. ClinicFlow replaces the paper register and WhatsApp threads with a single, role-aware
workspace where double bookings are impossible at the database level.

- **Frontend:** React 18 + Vite + TypeScript, Tailwind CSS, React Router, React Hook Form + Zod,
  Recharts, `@supabase/supabase-js`, jsPDF + jspdf-autotable.
- **Backend:** Supabase only — PostgreSQL, Auth, Row Level Security, RPC functions, Edge Functions
  (Deno), pg_cron + pg_net. No separate Node server.
- **Email:** Resend, called only from Edge Functions.
- **Hosting:** static `dist/` on Cloudflare Pages.

---

## Contents

1. [Feature overview](#feature-overview)
2. [Architecture](#architecture)
3. [Project structure](#project-structure)
4. [Local development](#local-development)
5. [Environment variables](#environment-variables)
6. [Database and security model](#database-and-security-model)
7. [Edge functions and email](#edge-functions-and-email)
8. [Deployment A — Supabase](#deployment-a--supabase)
9. [Deployment B — Cloudflare Pages](#deployment-b--cloudflare-pages)
10. [Post-deploy checklist](#post-deploy-checklist)
11. [Tests and quality checks](#tests-and-quality-checks)
12. [Troubleshooting](#troubleshooting)
13. [Security notes and limitations](#security-notes-and-limitations)

---

## Feature overview

| Area | Customer | Staff | Owner |
| --- | --- | --- | --- |
| Booking | Book/cancel own appointments, live free slots | — | — |
| Schedule | Own appointment history | List + date/status/practitioner filters, status updates | Same as staff |
| Invoices | View + download own PDF invoices | Create from appointment, line items, mark paid, PDF | Same as staff |
| Inventory | — | CRUD, stock in/out with reason, low-stock/expiry badges, CSV export | Same as staff |
| Analytics | — | — | Daily revenue line chart, busiest hours, top items, no-show rate |
| Administration | — | — | Services, staff availability, role management, audit log |
| Email | Booking confirmation + 24h reminder | — | Weekly low-stock/expiry digest |

Every signed-up account starts as **customer**. Only an owner can promote a user, and no one can
change their own role (enforced by an RLS policy *and* a database trigger).

---

## Architecture

```
Browser (React SPA on Cloudflare Pages)
  │  anon key + user JWT (never a service_role key)
  ├── Supabase Auth            signup, login, recovery
  ├── PostgREST / RLS          tables, views, RPC (book_appointment, create_invoice …)
  ├── Edge Functions           send-booking-confirmation (called after booking)
  └── jsPDF                    invoice PDF generated in the browser

Supabase Postgres
  ├── triggers                 profile bootstrap, role guard, stock movements, audit log
  ├── exclusion constraint     no overlapping appointments per practitioner
  ├── pg_cron + pg_net         daily reminders, weekly low-stock digest
  └── Edge Functions           send-reminders, send-low-stock-alert ──► Resend API
```

Double-booking protection is not a UI convention: `appointments_no_staff_overlap` is a GiST
exclusion constraint over `(staff_id, tstzrange(starts_at, ends_at))` for non-cancelled rows, so
two concurrent requests cannot both succeed.

---

## Project structure

```
clinicflow/
├── index.html
├── package.json
├── vite.config.ts               Vite + Vitest config (build → dist)
├── tsconfig.json                strict TS, noUncheckedIndexedAccess
├── tailwind.config.js           blue/teal palette, class-based dark mode
├── postcss.config.js
├── .env.example                 frontend env template (anon key only)
├── public/
│   ├── _headers                 CSP, HSTS, X-Frame-Options, …
│   ├── _redirects               /* /index.html 200 (SPA routing)
│   └── favicon.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx                  route table + config banner
│   ├── index.css                Tailwind layers
│   ├── components/
│   │   ├── AppShell.tsx         sidebar/topbar, role-aware navigation, dark mode
│   │   ├── AuthLayout.tsx
│   │   ├── Logo.tsx
│   │   ├── guards.tsx           ProtectedLayout, GuestOnly, RoleGate
│   │   ├── icons.tsx            inline SVG icon set (no icon dependency)
│   │   └── ui/                  Button, Field, Card, Modal, Badge, Spinner
│   ├── context/
│   │   ├── AuthContext.tsx      session, profile, role, auth actions
│   │   ├── ThemeContext.tsx
│   │   └── ToastContext.tsx
│   ├── hooks/
│   │   ├── useFetch.ts
│   │   └── useTheme.ts
│   ├── lib/
│   │   ├── config.ts            clinic branding/timezone from env
│   │   ├── supabase.ts          browser client (anon key only)
│   │   ├── schemas.ts           Zod validation for every form
│   │   ├── utils.ts             currency, dates, CSV, status maps, errors
│   │   ├── slots.ts             pure slot helpers (unit tested)
│   │   ├── pdf.ts               jsPDF invoice generator
│   │   ├── pdf-helpers.ts
│   │   └── __tests__/           Vitest unit tests
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── SignupPage.tsx
│   │   ├── ForgotPasswordPage.tsx
│   │   ├── ResetPasswordPage.tsx
│   │   ├── HomeRedirect.tsx
│   │   ├── NotFoundPage.tsx
│   │   ├── customer/            BookAppointment, MyAppointments, MyInvoices
│   │   ├── staff/               Dashboard, Appointments, Inventory, Billing
│   │   └── owner/               Services, Staff, Analytics, AuditLogs
│   └── types/
│       └── database.ts          hand-written schema types + Supabase Database generic
└── supabase/
    ├── config.toml              local CLI config, auth redirects, function JWT settings
    ├── seed.sql                 demo users/services/stock/appointments/invoices
    ├── templates/               confirmation + recovery email HTML
    ├── migrations/
    │   ├── 20260101000000_extensions_and_types.sql
    │   ├── 20260101000100_core_tables.sql
    │   ├── 20260101000200_functions_and_triggers.sql
    │   ├── 20260101000300_rls_policies.sql
    │   ├── 20260101000400_views.sql
    │   └── 20260101000500_cron_schedules.sql
    └── functions/
        ├── _shared/             http, supabase service client, Resend + HTML helpers
        ├── send-reminders/
        ├── send-low-stock-alert/
        └── send-booking-confirmation/
```

---

## Local development

Prerequisites: Node.js 20+, Docker Desktop, and the Supabase CLI
(`npm install -g supabase` or `brew install supabase/tap/supabase`).

```bash
# 1. Install frontend dependencies
npm install

# 2. Start the local Supabase stack (Postgres, Auth, Studio, Inbucket)
supabase start

# 3. Apply migrations + seed data (destroys and recreates the local DB)
supabase db reset

# 4. Copy the local URL and anon key printed by `supabase status` into .env
cp .env.example .env
#    VITE_SUPABASE_URL=http://127.0.0.1:54321
#    VITE_SUPABASE_ANON_KEY=<anon key from supabase status>

# 5. Start the app
npm run dev          # http://localhost:5173
```

Useful local commands:

```bash
supabase status                 # URLs and keys
supabase db diff                # schema drift
supabase functions serve send-booking-confirmation --env-file ./supabase/.env.local
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

Frontend (`.env`, also set in Cloudflare Pages):

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | Public anon key (safe for browsers) |
| `VITE_CLINIC_NAME` | no | Branding in the shell and PDF header |
| `VITE_CLINIC_ADDRESS` | no | PDF header |
| `VITE_CLINIC_PHONE` | no | PDF header |
| `VITE_CLINIC_EMAIL` | no | PDF header |
| `VITE_CLINIC_CURRENCY` | no | ISO currency code, default `USD` |
| `VITE_CLINIC_TIMEZONE` | no | IANA zone used for display, default `UTC` |

> **Never** put `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` or any other secret in a `VITE_*`
> variable. Vite inlines those into the public bundle.

Edge Function secrets (Supabase only, never in this repo):

| Secret | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | yes | Resend API authentication |
| `RESEND_FROM_EMAIL` | recommended | Verified sender, e.g. `ClinicFlow <no-reply@yourclinic.com>` |
| `CLINIC_NAME` | no | Email branding |
| `CLINIC_TIMEZONE` | no | Email date formatting |
| `CLINIC_CURRENCY` | no | Email currency |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected into deployed Edge
Functions automatically.

---

## Database and security model

### Migrations (apply in filename order)

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
   (all `security_invoker = true`).
6. **Cron schedules** — `schedule_clinicflow_jobs()` using Vault secrets + pg_net.

### Key rules

- `get_my_role()` is `SECURITY DEFINER` with `set search_path = public, pg_temp` and is the only
  role helper used by policies, which prevents RLS recursion on `profiles`.
- Customers can read/insert (pending only)/cancel their own appointments and read their own
  invoices + invoice items. Staff and owners see clinic-wide records. Only owners manage services,
  availability, roles, analytics and audit logs.
- `guard_profile_role_change` blocks self-promotion even if a policy is ever misconfigured.
- `book_appointment()` enforces: authenticated user, future date, ≤ 90 days ahead, active service,
  valid practitioner, max **5 bookings per customer per rolling hour**, and the time must be
  returned by `get_available_slots()`. The exclusion constraint is the final race guard.
- `inventory_movements` is append-only; inserting a movement updates stock atomically and raises if
  the result would be negative.
- Every change to appointments, inventory items, invoices and `profiles.role` writes to
  `audit_logs` through a `SECURITY DEFINER` trigger; only owners can read them.
- `total` and `line_total` are generated columns, so invoice math cannot drift.
- Client validation (Zod) mirrors SQL CHECK constraints; the database remains authoritative.

### Clinic timezone

Weekly availability is stored as wall-clock times. Slot generation and reporting interpret them in
the timezone returned by `public.clinic_timezone()`, which reads the `clinicflow.timezone` setting
and falls back to `UTC`.

```sql
alter database postgres set clinicflow.timezone = 'Europe/London';
-- then reconnect/reload, or run: select pg_reload_conf();
```

Set `VITE_CLINIC_TIMEZONE` to the **same** zone so displayed times match bookable slots. Email
formatting uses `CLINIC_TIMEZONE` on the Edge Functions.

---

## Edge functions and email

| Function | Trigger | Auth check |
| --- | --- | --- |
| `send-booking-confirmation` | Browser calls it after a successful booking | Caller's JWT + RLS visibility of the appointment |
| `send-reminders` | pg_cron, daily 08:00 UTC | `Authorization: Bearer <service_role_key>` |
| `send-low-stock-alert` | pg_cron, Mondays 07:00 UTC | `Authorization: Bearer <service_role_key>` |

Reminders cover appointments in the **next 24 hours** with status `pending` or `confirmed`. The
low-stock digest includes every item at/below its reorder level and every item expiring within 30
days (including already-expired stock), and is sent to all owners.

Email sending is best-effort on booking: a Resend failure never rolls back a confirmed appointment.

### Manual test of a deployed function

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/send-reminders" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `200` with `{ "checked": n, "sent": n, ... }`. A `401` means the Authorization header is
not exactly the service role key.

---

## Deployment A — Supabase

### A1. Create the project

1. Create a project at <https://supabase.com/dashboard>. Choose a region close to the clinic and save
   the database password.
2. From **Project Settings → API** copy:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` public key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → keep secret; never put it in the frontend.

### A2. Push the schema

With the Supabase CLI:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push          # applies supabase/migrations in order
```

Without the CLI: open **SQL Editor** and run the migration files in filename order, then optionally
run `supabase/seed.sql`.

The first migration enables `pg_cron` and `pg_net`. If your plan/project does not allow an
extension, enable it under **Database → Extensions** and re-run that migration.

### A3. Configure the clinic timezone

```sql
alter database postgres set clinicflow.timezone = 'Europe/London';  -- your zone
select pg_reload_conf();
```

### A4. Configure Auth

1. **Authentication → Providers → Email**: enable Email. Decide whether “Confirm email” is on.
   For production, keep it on.
2. **Authentication → URL Configuration**:
   - Site URL: `https://your-app.pages.dev` (or your custom domain)
   - Redirect URLs: `https://your-app.pages.dev/login`, `https://your-app.pages.dev/reset-password`,
     plus `http://localhost:5173/**` for local development.
3. Optional: customise the templates under **Authentication → Email Templates** (the repo includes
   `supabase/templates/confirmation.html` and `recovery.html` for the CLI).
4. Password policy: minimum 8 characters is enforced client-side and by the seed/config.

### A5. Create the first owner

New signups are always customers by design, so bootstrap the first owner manually:

1. Sign up through the app (or **Authentication → Users → Add user**).
2. In the SQL editor:

```sql
update public.profiles
set role = 'owner'
where id = (select id from auth.users where email = 'you@yourclinic.com');

select id, full_name, role from public.profiles order by created_at;
```

Promote staff the same way, or from **Staff & roles** inside the app afterwards. The role change
trigger allows this because it runs as the database owner (no `auth.uid()`), and every subsequent
role change made from the app is audited.

### A6. Resend

1. Create a Resend account and **verify your sending domain** (DNS records). Until a domain is
   verified, Resend only delivers to your own account email.
2. Create an API key with sending permission.
3. Set the secrets (never commit them):

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxx \
  RESEND_FROM_EMAIL="ClinicFlow <no-reply@yourclinic.com>" \
  CLINIC_NAME="Your Clinic" \
  CLINIC_TIMEZONE="Europe/London" \
  CLINIC_CURRENCY="GBP"
```

Or paste them in **Project Settings → Edge Functions → Secrets**. In the Sites/Cloudflare world,
keep the key out of the frontend entirely.

### A7. Deploy the Edge Functions

```bash
supabase functions deploy send-booking-confirmation
supabase functions deploy send-reminders
supabase functions deploy send-low-stock-alert
```

JWT verification is configured in `supabase/config.toml`: the booking confirmation requires a JWT
(the browser sends it automatically), while the two cron functions verify the service role key
themselves. If you deploy with the dashboard instead, set **Verify JWT** accordingly.

### A8. Schedule the cron jobs

The schedule SQL is in `20260101000500_cron_schedules.sql`. It reads the project URL and service
role key from **Vault** so no secret is stored in migrations:

1. **Project Settings → Vault → Add new secret**
   - `project_url` = `https://<project-ref>.supabase.co` (no trailing slash)
   - `service_role_key` = the service role key
2. Run in the SQL editor:

```sql
select public.schedule_clinicflow_jobs();
select jobid, jobname, schedule, active from cron.job;
```

Jobs created:

| Job | Schedule (UTC) | Function |
| --- | --- | --- |
| `clinicflow-send-reminders` | `0 8 * * *` | daily reminders |
| `clinicflow-low-stock-alert` | `0 7 * * 1` | Monday inventory digest |

Change the cron expressions to match the clinic's local morning, then re-run the function. Inspect
runs with:

```sql
select * from cron.job_run_details order by start_time desc limit 20;
select * from net._http_response order by created desc limit 20;
```

If the Vault secrets are missing, the migration still succeeds and prints a notice; the jobs are
simply not scheduled yet.

---

## Deployment B — Cloudflare Pages

1. Push this repository to GitHub.
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repository and use:

   | Setting | Value |
   | --- | --- |
   | Framework preset | Vite (or None) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node version | 20 or newer (`NODE_VERSION=20`) |

4. **Environment variables** (Production *and* Preview):

   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   VITE_CLINIC_NAME=Your Clinic
   VITE_CLINIC_TIMEZONE=Europe/London
   VITE_CLINIC_CURRENCY=GBP
   VITE_CLINIC_ADDRESS=...
   VITE_CLINIC_PHONE=...
   VITE_CLINIC_EMAIL=...
   ```

5. Deploy. `public/_redirects` provides the SPA fallback (`/* /index.html 200`) and
   `public/_headers` adds CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
   `Referrer-Policy` and `Permissions-Policy`.
6. Add the Pages URL (and custom domain) to Supabase **Authentication → URL Configuration**.
7. Optional custom domain: **Pages → Custom domains → Set up a domain**, then add
   `https://clinic.yourdomain.com/login` and `/reset-password` to the Supabase redirect allow list.

### Content Security Policy note

`public/_headers` allows connections to `https://*.supabase.co` and `wss://*.supabase.co`. If you
front Supabase with a custom domain, add that host to `connect-src`. Inline styles are allowed
because Recharts and the PDF preview use them; no inline scripts or `eval` are used, and the app
never calls `dangerouslySetInnerHTML`.

---

## Post-deploy checklist

Run through this on the deployed URL, in a private window, with fresh accounts:

**Roles and routing**
- [ ] Sign up as a new user → lands in customer booking flow; `/app/dashboard` redirects back.
- [ ] Owner promotes the user in **Staff & roles** → after refresh the staff nav appears.
- [ ] Owner cannot change their own role in the UI or via SQL as themselves.
- [ ] Customer cannot open `/app/analytics` or `/app/audit-logs` (role gate redirects).

**Booking and double booking**
- [ ] Customer books a service → appointment appears as `pending`, confirmation email arrives.
- [ ] In two browser windows, try to book the exact same practitioner/time → the second request is
      rejected with “That slot was just booked by someone else.”
- [ ] Booking 6 times within an hour returns the rate-limit message.
- [ ] Customer cancels → slot immediately becomes available again.
- [ ] Owner deactivates a service → it disappears from the booking step.

**RLS**
- [ ] In the browser console of customer A, run
      `await supabase.from('appointments').select('*')` → only A's rows.
- [ ] With customer A's session, run
      `await supabase.from('profiles').update({ role: 'owner' }).eq('id', <A id>)` → denied.
- [ ] With an anonymous client (anon key, no session), `select` on `invoices` and `patients`
      returns nothing.
- [ ] A customer reading `daily_revenue` sees at most their own paid invoices (owner sees all).

**Operations**
- [ ] Inventory: add an item, record stock in/out, confirm quantity changes and the movement is
      logged; CSV export downloads.
- [ ] Low stock + expiring views populate the dashboard.
- [ ] Billing: create an invoice from an appointment, verify totals, mark paid, download PDF with
      the clinic header.
- [ ] Audit log shows the appointment/invoice/role changes with actor and JSON details.
- [ ] Forgot password → email link opens `/reset-password` → new password works.
- [ ] Dark mode toggle and mobile layout (≤ 400 px) are usable.

**Database**
- [ ] `select * from cron.job;` lists both ClinicFlow jobs as active.
- [ ] `select * from cron.job_run_details order by start_time desc limit 5;` shows successful runs.
- [ ] `select * from supabase_migrations.schema_migrations;` includes all six migrations.

---

## Tests and quality checks

```bash
npm run typecheck      # strict TypeScript, no `any`
npm test               # Vitest: invoice math, dates, CSV, slot generation, partition
npm run build          # typecheck + production bundle into dist/
npm run preview        # serve the built bundle locally
```

The suite covers the pure slot logic that mirrors `get_available_slots` and the invoice math that
mirrors the SQL generated columns, plus date/timezone, CSV escaping and error mapping.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Amber “Supabase is not configured” banner | `.env` missing or Vite env vars not set; rebuild after changing them. |
| Login fails with “Invalid login credentials” | Email not confirmed (check Auth settings / inbox) or wrong password. |
| “Your profile is not ready yet” | The `on_auth_user_created` trigger did not run or migrations are missing; sign out/in, verify `select * from public.profiles`. |
| New user sees customer nav after promotion | Refresh; the profile is cached in the session context. |
| Edge function returns 401 | Missing/incorrect Authorization header, or `RESEND_API_KEY` not set when calling Resend. |
| Emails not delivered | Resend domain not verified, sender not allowed, check `net._http_response` and function logs. |
| Cron jobs missing | Vault secrets `project_url`/`service_role_key` not created; run `select public.schedule_clinicflow_jobs();`. |
| Slots look shifted by hours | `clinicflow.timezone` in Postgres and `VITE_CLINIC_TIMEZONE`/`CLINIC_TIMEZONE` disagree. |
| Second booking returns a constraint error | Expected under concurrency; the UI maps it to a friendly “slot just taken” message. |
| PDF download blocked | Browser popup/download blocker; jsPDF uses a Blob download, no server involved. |

---

## Security notes and limitations

**Security**

- RLS is enabled on every table, including `audit_logs`; there are no “allow all” policies.
- The frontend only ever holds the anon key and the user's JWT. Service-role access exists only in
  Edge Functions and pg_cron.
- All user text is rendered through React (escaped automatically); the codebase contains no
  `dangerouslySetInnerHTML`. Email templates escape every interpolated value.
- All mutations are validated by Zod and by SQL CHECK constraints; policies scope rows by
  `auth.uid()` / role.
- Security headers are applied by Cloudflare Pages; `frame-ancestors 'none'` and
  `X-Frame-Options: DENY` prevent clickjacking.
- Booking is rate-limited in the database (5/hour/customer), not just in the browser.

**Intentional limitations**

- One clinic per deployment (single-tenant). Multi-clinic tenancy would need a `clinic_id` column and
  updated policies.
- Staff schedule new appointments only through the customer flow; a staff-side “book for patient”
  form is not included.
- Invoices are one-off documents; there is no payment gateway integration (mark-as-paid only).
- Reminder and digest schedules are fixed in SQL; adjust the cron expressions and redeploy.
- `dist/` is a static SPA; server-side rendering is intentionally not used.

---

## Manual steps you must do yourself

These cannot be automated from the repository:

| # | Task | Where |
| --- | --- | --- |
| 1 | Create the Supabase project and copy URL + anon key | Supabase Dashboard |
| 2 | `supabase login`, `supabase link`, `supabase db push` (or run migrations in SQL Editor) | CLI / SQL Editor |
| 3 | Set `clinicflow.timezone` and `pg_reload_conf()` | SQL Editor |
| 4 | Enable Email auth, set Site URL + redirect URLs | Authentication settings |
| 5 | Sign up and promote the first owner via SQL | SQL Editor |
| 6 | Create a Resend account, verify sending domain, create API key | resend.com |
| 7 | `supabase secrets set RESEND_API_KEY=… RESEND_FROM_EMAIL=…` | CLI / Dashboard |
| 8 | Deploy the three Edge Functions | `supabase functions deploy …` |
| 9 | Add Vault secrets `project_url` and `service_role_key`, run `schedule_clinicflow_jobs()` | SQL Editor |
| 10 | Create the Cloudflare Pages project, set build/output and env vars | Cloudflare Dashboard |
| 11 | Add the Pages/custom domain to Supabase redirect URLs | Authentication settings |
| 12 | Rotate/delete the seeded demo accounts before going live | Supabase / app |
| 13 | Complete the post-deploy checklist above | Browser + SQL |
