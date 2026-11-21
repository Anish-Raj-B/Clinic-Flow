-- ===========================================================================
-- ClinicFlow · 02 · Core tables
-- ===========================================================================
-- All primary keys are UUIDs and every table has created_at. CHECK constraints
-- mirror the client-side Zod schemas so invalid data cannot reach the database.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. Role is managed by owners only.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone text check (phone is null or char_length(phone) <= 30),
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'ClinicFlow user profile, created automatically from auth.users.';

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  description text check (description is null or char_length(description) <= 1000),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price numeric(10, 2) not null default 0 check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- staff_availability: recurring weekly working hours per practitioner
-- weekday follows PostgreSQL extract(dow): 0 = Sunday ... 6 = Saturday
-- ---------------------------------------------------------------------------
create table public.staff_availability (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint staff_availability_time_order check (end_time > start_time),
  constraint staff_availability_unique unique (staff_id, weekday, start_time)
);

create index staff_availability_staff_idx on public.staff_availability (staff_id, weekday);

-- ---------------------------------------------------------------------------
-- appointments
-- The exclusion constraint is the hard guarantee against double booking for
-- the same practitioner. Cancelled and no-show visits release the slot.
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  staff_id uuid not null references public.profiles (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'pending',
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_order check (ends_at > starts_at),
  constraint appointments_no_staff_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('cancelled', 'no_show'))
);

comment on constraint appointments_no_staff_overlap on public.appointments is
  'Prevents overlapping non-cancelled appointments for the same practitioner.';

create index appointments_customer_idx on public.appointments (customer_id, starts_at desc);
create index appointments_staff_idx on public.appointments (staff_id, starts_at);
create index appointments_starts_at_idx on public.appointments (starts_at);
create index appointments_created_at_idx on public.appointments (created_at);
create index appointments_status_idx on public.appointments (status);

-- ---------------------------------------------------------------------------
-- inventory
-- ---------------------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  sku text not null unique check (char_length(sku) between 1 and 60),
  category text check (category is null or char_length(category) <= 60),
  quantity integer not null default 0 check (quantity >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  unit_price numeric(10, 2) not null default 0 check (unit_price >= 0),
  expiry_date date,
  supplier text check (supplier is null or char_length(supplier) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_items_category_idx on public.inventory_items (category);
create index inventory_items_expiry_idx on public.inventory_items (expiry_date);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  change integer not null check (change <> 0),
  reason text not null check (char_length(reason) between 3 and 200),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index inventory_movements_item_idx on public.inventory_movements (item_id, created_at desc);

-- ---------------------------------------------------------------------------
-- billing
-- total / line_total are generated so they can never drift from the parts.
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id) on delete set null,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  subtotal numeric(10, 2) not null default 0 check (subtotal >= 0),
  tax numeric(10, 2) not null default 0 check (tax >= 0),
  total numeric(10, 2) generated always as (subtotal + tax) stored,
  status public.invoice_status not null default 'unpaid',
  created_at timestamptz not null default now()
);

create index invoices_customer_idx on public.invoices (customer_id, created_at desc);
create index invoices_status_idx on public.invoices (status);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  quantity integer not null check (quantity between 1 and 10000),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

create index invoice_items_invoice_idx on public.invoice_items (invoice_id);

-- ---------------------------------------------------------------------------
-- audit trail. Writes happen only through SECURITY DEFINER triggers.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) between 1 and 40),
  table_name text not null check (char_length(table_name) between 1 and 80),
  record_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_table_idx on public.audit_logs (table_name);
create index audit_logs_user_idx on public.audit_logs (user_id);
