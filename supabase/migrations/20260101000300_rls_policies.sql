-- ===========================================================================
-- ClinicFlow · 04 · Row Level Security
-- ===========================================================================
-- Every table has RLS enabled. Policies use get_my_role() (SECURITY DEFINER,
-- fixed search_path) so role checks cannot recurse into profiles policies.
-- ===========================================================================

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.staff_availability enable row level security;
alter table public.appointments enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles_select_self_or_clinic"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or role in ('staff', 'owner')     -- customers may see who they book with
    or public.is_staff_or_owner()     -- staff see patient contact details
  );

create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() and role = 'customer');

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.get_my_role());

create policy "profiles_update_owner"
  on public.profiles for update
  to authenticated
  using (public.get_my_role() = 'owner')
  with check (public.get_my_role() = 'owner');

create policy "profiles_delete_owner"
  on public.profiles for delete
  to authenticated
  using (public.get_my_role() = 'owner');

-- ---------------------------------------------------------------------------
-- services: active services are public; only owners manage them
-- ---------------------------------------------------------------------------
create policy "services_select_active_or_staff"
  on public.services for select
  to anon, authenticated
  using (active = true or public.is_staff_or_owner());

create policy "services_insert_owner"
  on public.services for insert
  to authenticated
  with check (public.get_my_role() = 'owner');

create policy "services_update_owner"
  on public.services for update
  to authenticated
  using (public.get_my_role() = 'owner')
  with check (public.get_my_role() = 'owner');

create policy "services_delete_owner"
  on public.services for delete
  to authenticated
  using (public.get_my_role() = 'owner');

-- ---------------------------------------------------------------------------
-- staff_availability: visible to signed-in users, managed by owners
-- ---------------------------------------------------------------------------
create policy "staff_availability_select_authenticated"
  on public.staff_availability for select
  to authenticated
  using (true);

create policy "staff_availability_insert_owner"
  on public.staff_availability for insert
  to authenticated
  with check (public.get_my_role() = 'owner');

create policy "staff_availability_update_owner"
  on public.staff_availability for update
  to authenticated
  using (public.get_my_role() = 'owner')
  with check (public.get_my_role() = 'owner');

create policy "staff_availability_delete_owner"
  on public.staff_availability for delete
  to authenticated
  using (public.get_my_role() = 'owner');

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create policy "appointments_select_own_or_clinic"
  on public.appointments for select
  to authenticated
  using (customer_id = auth.uid() or public.is_staff_or_owner());

create policy "appointments_insert_own_pending"
  on public.appointments for insert
  to authenticated
  with check (
    (customer_id = auth.uid() and status = 'pending')
    or public.is_staff_or_owner()
  );

create policy "appointments_update_clinic"
  on public.appointments for update
  to authenticated
  using (public.is_staff_or_owner())
  with check (public.is_staff_or_owner());

create policy "appointments_update_own_cancel"
  on public.appointments for update
  to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid() and status = 'cancelled');

create policy "appointments_delete_owner"
  on public.appointments for delete
  to authenticated
  using (public.get_my_role() = 'owner');

-- ---------------------------------------------------------------------------
-- inventory (staff + owner)
-- ---------------------------------------------------------------------------
create policy "inventory_items_select_clinic"
  on public.inventory_items for select
  to authenticated
  using (public.is_staff_or_owner());

create policy "inventory_items_insert_clinic"
  on public.inventory_items for insert
  to authenticated
  with check (public.is_staff_or_owner());

create policy "inventory_items_update_clinic"
  on public.inventory_items for update
  to authenticated
  using (public.is_staff_or_owner())
  with check (public.is_staff_or_owner());

create policy "inventory_items_delete_clinic"
  on public.inventory_items for delete
  to authenticated
  using (public.is_staff_or_owner());

create policy "inventory_movements_select_clinic"
  on public.inventory_movements for select
  to authenticated
  using (public.is_staff_or_owner());

create policy "inventory_movements_insert_clinic"
  on public.inventory_movements for insert
  to authenticated
  with check (public.is_staff_or_owner() and created_by = auth.uid());

-- Movements are append-only: no update/delete policies on purpose.

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
create policy "invoices_select_own_or_clinic"
  on public.invoices for select
  to authenticated
  using (customer_id = auth.uid() or public.is_staff_or_owner());

create policy "invoices_insert_clinic"
  on public.invoices for insert
  to authenticated
  with check (public.is_staff_or_owner());

create policy "invoices_update_clinic"
  on public.invoices for update
  to authenticated
  using (public.is_staff_or_owner())
  with check (public.is_staff_or_owner());

create policy "invoices_delete_owner"
  on public.invoices for delete
  to authenticated
  using (public.get_my_role() = 'owner');

create policy "invoice_items_select_own_or_clinic"
  on public.invoice_items for select
  to authenticated
  using (
    public.is_staff_or_owner()
    or exists (
      select 1
      from public.invoices i
      where i.id = invoice_items.invoice_id
        and i.customer_id = (select auth.uid())
    )
  );

create policy "invoice_items_insert_clinic"
  on public.invoice_items for insert
  to authenticated
  with check (public.is_staff_or_owner());

create policy "invoice_items_update_clinic"
  on public.invoice_items for update
  to authenticated
  using (public.is_staff_or_owner())
  with check (public.is_staff_or_owner());

create policy "invoice_items_delete_clinic"
  on public.invoice_items for delete
  to authenticated
  using (public.is_staff_or_owner());

-- ---------------------------------------------------------------------------
-- audit logs: read-only and owners only. Triggers write as definer.
-- ---------------------------------------------------------------------------
create policy "audit_logs_select_owner"
  on public.audit_logs for select
  to authenticated
  using (public.get_my_role() = 'owner');

-- ---------------------------------------------------------------------------
-- Explicit grants (Supabase grants these by default; re-stated for clarity).
-- Column data is still protected by RLS above.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.services to anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.services to authenticated;
grant insert, update, delete on public.services to authenticated;
grant select on public.staff_availability to authenticated;
grant insert, update, delete on public.staff_availability to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert on public.inventory_movements to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;
grant select on public.audit_logs to authenticated;
