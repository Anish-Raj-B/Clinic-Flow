-- ===========================================================================
-- ClinicFlow · 03 · Functions and triggers
-- ===========================================================================
-- Includes: profile bootstrap, role guards, slot generation, booking with a
-- rate limit, cancellation, inventory movements, audit trail and invoicing.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Clinic timezone: wall-clock times in staff_availability are interpreted in
-- this zone. Set once per project with:
--   alter database postgres set clinicflow.timezone = 'Europe/London';
-- Fallback is UTC.
-- ---------------------------------------------------------------------------
create or replace function public.clinic_timezone()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('clinicflow.timezone', true), ''), 'UTC');
$$;

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so RLS policies cannot recurse)
-- ---------------------------------------------------------------------------
create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid()),
    'customer'::public.user_role
  );
$$;

create or replace function public.is_staff_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.get_my_role() in ('staff', 'owner');
$$;

revoke all on function public.get_my_role() from public, anon;
revoke all on function public.is_staff_or_owner() from public;
grant execute on function public.get_my_role() to authenticated;
-- is_staff_or_owner() is referenced by the anon-visible services policy, so
-- anonymous callers need EXECUTE (it simply returns false for them).
grant execute on function public.is_staff_or_owner() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

create trigger inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New auth user -> profile (always a customer)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_full_name text;
  v_phone text;
begin
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Clinic user'
  );
  if char_length(v_full_name) < 2 then
    v_full_name := 'Clinic user';
  end if;

  v_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', new.phone, '')), '');

  insert into public.profiles (id, full_name, phone, role)
  values (new.id, left(v_full_name, 100), left(v_phone, 30), 'customer')
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Role guard: nobody can change their own role; only owners change roles.
-- Runs in addition to the RLS WITH CHECK policies.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() = old.id then
      raise exception 'You cannot change your own role' using errcode = '42501';
    end if;
    if auth.uid() is not null and public.get_my_role() <> 'owner' then
      raise exception 'Only owners can change roles' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role_change
  before update of role on public.profiles
  for each row execute function public.guard_profile_role_change();

-- ---------------------------------------------------------------------------
-- Appointment guard: customers may only cancel their own appointment and may
-- not rewrite times, staff, service or notes.
-- ---------------------------------------------------------------------------
create or replace function public.guard_customer_appointment_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- auth.uid() is null for migrations/seed (run as postgres): allow.
  if auth.uid() is not null and public.get_my_role() = 'customer' then
    if new.status <> 'cancelled' then
      raise exception 'Customers can only cancel appointments' using errcode = '42501';
    end if;
    if new.customer_id is distinct from old.customer_id
      or new.staff_id is distinct from old.staff_id
      or new.service_id is distinct from old.service_id
      or new.starts_at is distinct from old.starts_at
      or new.ends_at is distinct from old.ends_at
      or new.notes is distinct from old.notes then
      raise exception 'Customers may only change the appointment status to cancelled'
        using errcode = '42501';
    end if;
    if old.status not in ('pending', 'confirmed') then
      raise exception 'Only pending or confirmed appointments can be cancelled'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger appointments_guard_customer_update
  before update on public.appointments
  for each row execute function public.guard_customer_appointment_update();

-- ---------------------------------------------------------------------------
-- Inventory: movements adjust stock atomically and never below zero.
-- ---------------------------------------------------------------------------
create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current integer;
begin
  select quantity into v_current
  from public.inventory_items
  where id = new.item_id
  for update;

  if not found then
    raise exception 'Inventory item not found' using errcode = '23503';
  end if;

  if v_current + new.change < 0 then
    raise exception 'Insufficient stock: % units available', v_current using errcode = '23514';
  end if;

  update public.inventory_items
  set quantity = quantity + new.change,
      updated_at = now()
  where id = new.item_id;

  return new;
end;
$$;

create trigger inventory_movements_apply
  after insert on public.inventory_movements
  for each row execute function public.apply_inventory_movement();

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_record_id uuid;
  v_details jsonb;
begin
  if tg_op = 'DELETE' then
    v_record_id := old.id;
    v_details := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'UPDATE' then
    v_record_id := new.id;
    v_details := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  else
    v_record_id := new.id;
    v_details := jsonb_build_object('new', to_jsonb(new));
  end if;

  insert into public.audit_logs (user_id, action, table_name, record_id, details)
  values (auth.uid(), tg_op, tg_table_name, v_record_id, v_details);

  return null;
end;
$$;

create trigger audit_appointments
  after insert or update or delete on public.appointments
  for each row execute function public.log_audit_event();

create trigger audit_inventory_items
  after insert or update or delete on public.inventory_items
  for each row execute function public.log_audit_event();

create trigger audit_invoices
  after insert or update or delete on public.invoices
  for each row execute function public.log_audit_event();

create trigger audit_profiles_role
  after update of role on public.profiles
  for each row
  when (old.role is distinct from new.role)
  execute function public.log_audit_event();

-- ---------------------------------------------------------------------------
-- Available slots
-- Free = within a weekly availability block, aligned to the service duration,
-- in the future and not overlapping any non-cancelled appointment.
-- SECURITY DEFINER so customers can see true availability without reading
-- other patients' appointments.
-- ---------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_service_id uuid,
  p_staff_id uuid,
  p_date date
)
returns table (slot_start timestamptz, slot_end timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with service as (
    select s.duration_minutes
    from public.services s
    where s.id = p_service_id
      and s.active = true
  ),
  availability as (
    select a.start_time, a.end_time
    from public.staff_availability a
    where a.staff_id = p_staff_id
      and a.weekday = extract(dow from p_date)::integer
  ),
  candidate_slots as (
    select
      (g.slot_local at time zone public.clinic_timezone()) as slot_start,
      ((g.slot_local + make_interval(mins => s.duration_minutes))
        at time zone public.clinic_timezone()) as slot_end
    from availability a
    cross join service s
    cross join lateral generate_series(
      p_date::timestamp + a.start_time,
      p_date::timestamp + a.end_time - make_interval(mins => s.duration_minutes),
      make_interval(mins => s.duration_minutes)
    ) as g(slot_local)
  )
  select c.slot_start, c.slot_end
  from candidate_slots c
  where c.slot_start > now()
    and not exists (
      select 1
      from public.appointments a
      where a.staff_id = p_staff_id
        and a.status not in ('cancelled', 'no_show')
        and tstzrange(a.starts_at, a.ends_at, '[)')
            && tstzrange(c.slot_start, c.slot_end, '[)')
    )
  order by c.slot_start;
$$;

grant execute on function public.get_available_slots(uuid, uuid, date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Booking rate limit: max 5 bookings per customer per rolling hour.
-- ---------------------------------------------------------------------------
create or replace function public.booking_rate_limit_ok(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*) < 5
  from public.appointments
  where customer_id = p_customer_id
    and created_at > now() - interval '1 hour';
$$;

revoke all on function public.booking_rate_limit_ok(uuid) from public, anon;
grant execute on function public.booking_rate_limit_ok(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Booking RPC
-- Validates the slot against get_available_slots, applies the rate limit and
-- relies on the exclusion constraint for the final race-condition guard.
-- ---------------------------------------------------------------------------
create or replace function public.book_appointment(
  p_service_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_notes text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_service public.services;
  v_staff_role public.user_role;
  v_ends_at timestamptz;
  v_appointment public.appointments;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_starts_at < now() then
    raise exception 'Appointments must be booked in the future';
  end if;

  if p_starts_at > now() + interval '90 days' then
    raise exception 'Appointments can be booked up to 90 days ahead';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id
    and active = true;

  if not found then
    raise exception 'That service is not available for booking';
  end if;

  select role into v_staff_role from public.profiles where id = p_staff_id;
  if v_staff_role is null or v_staff_role not in ('staff', 'owner') then
    raise exception 'The selected practitioner is not available';
  end if;

  if not public.booking_rate_limit_ok(v_user) then
    raise exception 'Booking limit reached: at most 5 bookings per hour'
      using errcode = '53400';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);

  if not exists (
    select 1
    from public.get_available_slots(
      p_service_id,
      p_staff_id,
      ((p_starts_at at time zone public.clinic_timezone())::date)
    ) as slot
    where slot.slot_start = p_starts_at
  ) then
    raise exception 'That time slot is no longer available' using errcode = '23P01';
  end if;

  insert into public.appointments (
    customer_id, staff_id, service_id, starts_at, ends_at, status, notes
  )
  values (
    v_user, p_staff_id, p_service_id, p_starts_at, v_ends_at, 'pending',
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning * into v_appointment;

  return v_appointment;
end;
$$;

revoke all on function public.book_appointment(uuid, uuid, timestamptz, text) from public, anon;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancellation RPC (customer owns it, or staff/owner)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_appointment(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_appointment public.appointments;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;

  if v_appointment.customer_id <> v_user and public.get_my_role() not in ('staff', 'owner') then
    raise exception 'You are not allowed to cancel this appointment' using errcode = '42501';
  end if;

  if v_appointment.status not in ('pending', 'confirmed') then
    raise exception 'Only pending or confirmed appointments can be cancelled';
  end if;

  update public.appointments
  set status = 'cancelled',
      updated_at = now()
  where id = p_appointment_id
  returning * into v_appointment;

  return v_appointment;
end;
$$;

revoke all on function public.cancel_appointment(uuid) from public, anon;
grant execute on function public.cancel_appointment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic invoice creation with server-computed totals.
-- Runs as the caller (SECURITY INVOKER) so RLS writes are still enforced.
-- ---------------------------------------------------------------------------
create or replace function public.create_invoice(
  p_customer_id uuid,
  p_appointment_id uuid,
  p_tax_rate numeric,
  p_items jsonb
)
returns public.invoices
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_subtotal numeric(10, 2);
  v_tax numeric(10, 2);
  v_invoice public.invoices;
  v_item jsonb;
begin
  if public.get_my_role() not in ('staff', 'owner') then
    raise exception 'Only staff and owners can create invoices' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one line item is required';
  end if;

  if p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'Tax rate must be between 0 and 100';
  end if;

  if p_appointment_id is not null and not exists (
    select 1
    from public.appointments a
    where a.id = p_appointment_id
      and a.customer_id = p_customer_id
  ) then
    raise exception 'The selected appointment does not belong to that customer';
  end if;

  select coalesce(sum((item ->> 'quantity')::integer * (item ->> 'unit_price')::numeric), 0)
  into v_subtotal
  from jsonb_array_elements(p_items) as item;

  v_subtotal := round(v_subtotal, 2);
  v_tax := round(v_subtotal * p_tax_rate / 100, 2);

  insert into public.invoices (appointment_id, customer_id, subtotal, tax, status)
  values (p_appointment_id, p_customer_id, v_subtotal, v_tax, 'unpaid')
  returning * into v_invoice;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.invoice_items (invoice_id, description, quantity, unit_price)
    values (
      v_invoice.id,
      trim(v_item ->> 'description'),
      (v_item ->> 'quantity')::integer,
      (v_item ->> 'unit_price')::numeric
    );
  end loop;

  return v_invoice;
end;
$$;

revoke all on function public.create_invoice(uuid, uuid, numeric, jsonb) from public, anon;
grant execute on function public.create_invoice(uuid, uuid, numeric, jsonb) to authenticated;
