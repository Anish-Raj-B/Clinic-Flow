-- ===========================================================================
-- ClinicFlow · 05 · Reporting views
-- ===========================================================================
-- security_invoker = true keeps RLS of the underlying tables in force.
-- ===========================================================================

-- Items at or below their reorder level, most urgent first.
create or replace view public.low_stock_items
with (security_invoker = true) as
select
  i.*,
  greatest(i.reorder_level - i.quantity, 0) as units_needed
from public.inventory_items i
where i.quantity <= i.reorder_level;

comment on view public.low_stock_items is 'Inventory items at or below reorder level.';

-- Items expiring within 30 days (already-expired stock is included with a
-- negative days_until_expiry so it can be written off).
create or replace view public.expiring_soon_items
with (security_invoker = true) as
select
  i.*,
  (i.expiry_date - current_date) as days_until_expiry
from public.inventory_items i
where i.expiry_date is not null
  and i.expiry_date <= current_date + 30;

comment on view public.expiring_soon_items is 'Stock expiring within 30 days or already expired.';

-- Paid revenue grouped by clinic-local day.
create or replace view public.daily_revenue
with (security_invoker = true) as
select
  (i.created_at at time zone public.clinic_timezone())::date as day,
  coalesce(sum(i.total), 0)::numeric(12, 2) as revenue,
  count(*)::integer as invoice_count
from public.invoices i
where i.status = 'paid'
group by 1
order by 1;

comment on view public.daily_revenue is 'Daily paid invoice revenue in the clinic timezone.';

-- Appointment demand by clinic-local hour of day.
create or replace view public.busiest_hours
with (security_invoker = true) as
select
  extract(hour from (a.starts_at at time zone public.clinic_timezone()))::integer as hour,
  count(*)::integer as appointments
from public.appointments a
where a.status <> 'cancelled'
group by 1
order by 1;

comment on view public.busiest_hours is 'Non-cancelled appointments grouped by clinic-local hour.';

grant select on public.low_stock_items to authenticated;
grant select on public.expiring_soon_items to authenticated;
grant select on public.daily_revenue to authenticated;
grant select on public.busiest_hours to authenticated;
