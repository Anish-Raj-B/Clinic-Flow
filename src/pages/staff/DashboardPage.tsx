import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertIcon,
  BoxIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  PillIcon,
  PlusIcon,
} from '../../components/icons';
import {
  AppointmentStatusBadge,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  InlineLoader,
  PageHeader,
  StatCard,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { supabase } from '../../lib/supabase';
import {
  formatDate,
  formatTime,
  getClinicDayRange,
  todayInClinicTimeZone,
} from '../../lib/utils';
import type {
  AppointmentWithRelations,
  ExpiringSoonItem,
  LowStockItem,
} from '../../types/database';

interface DashboardData {
  appointments: AppointmentWithRelations[];
  lowStock: LowStockItem[];
  expiring: ExpiringSoonItem[];
}

export function DashboardPage() {
  const { profile } = useAuth();
  const [today] = useState(() => todayInClinicTimeZone());

  const dashboard = useFetch<DashboardData>(async () => {
    const { start, end } = getClinicDayRange(today);
    const [appointments, lowStock, expiring] = await Promise.all([
      supabase
        .from('appointments')
        .select(
          '*, service:services(id, name, duration_minutes, price), staff:profiles!appointments_staff_id_fkey(id, full_name), customer:profiles!appointments_customer_id_fkey(id, full_name, phone)',
        )
        .gte('starts_at', start)
        .lt('starts_at', end)
        .order('starts_at', { ascending: true })
        .returns<AppointmentWithRelations[]>(),
      supabase
        .from('low_stock_items')
        .select('*')
        .order('units_needed', { ascending: false })
        .returns<LowStockItem[]>(),
      supabase
        .from('expiring_soon_items')
        .select('*')
        .order('days_until_expiry', { ascending: true })
        .returns<ExpiringSoonItem[]>(),
    ]);

    if (appointments.error) throw appointments.error;
    if (lowStock.error) throw lowStock.error;
    if (expiring.error) throw expiring.error;

    return {
      appointments: appointments.data ?? [],
      lowStock: lowStock.data ?? [],
      expiring: expiring.data ?? [],
    };
  }, [today]);

  const appointments = dashboard.data?.appointments ?? [];
  const confirmed = appointments.filter((appointment) => appointment.status === 'confirmed').length;
  const completed = appointments.filter((appointment) => appointment.status === 'completed').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good day, ${profile?.full_name?.split(' ')[0] ?? 'team'}`}
        description={`Here is what ${formatDate(today)} looks like across the clinic.`}
        actions={
          <>
            <Link to="/app/appointments">
              <Button variant="outline">
                <CalendarIcon className="h-4 w-4" />
                Schedule
              </Button>
            </Link>
            <Link to="/app/billing">
              <Button>
                <PlusIcon className="h-4 w-4" />
                New invoice
              </Button>
            </Link>
          </>
        }
      />

      {dashboard.error ? (
        <Card className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
            <AlertIcon className="h-4 w-4" />
            {dashboard.error}
          </p>
          <Button size="sm" variant="outline" onClick={dashboard.reload}>
            Try again
          </Button>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's appointments"
          value={dashboard.loading ? '—' : appointments.length}
          hint={`${confirmed} confirmed · ${completed} completed`}
          icon={<CalendarIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Low stock items"
          value={dashboard.loading ? '—' : (dashboard.data?.lowStock.length ?? 0)}
          hint="At or below reorder level"
          tone="amber"
          icon={<BoxIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Expiring in 30 days"
          value={dashboard.loading ? '—' : (dashboard.data?.expiring.length ?? 0)}
          hint="Review or write off soon"
          tone="rose"
          icon={<PillIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Next appointment"
          value={
            dashboard.loading || appointments.length === 0
              ? '—'
              : formatTime(
                  appointments.find((appointment) => appointment.status !== 'cancelled')?.starts_at ??
                    appointments[0]?.starts_at ??
                    today,
                )
          }
          hint={appointments[0]?.customer?.full_name ?? 'Nothing scheduled'}
          tone="accent"
          icon={<ClockIcon className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Today's schedule"
            description="Live view of every appointment booked for today."
            actions={
              <Link
                to="/app/appointments"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                Manage <ChevronRightIcon className="h-4 w-4" />
              </Link>
            }
          />
          {dashboard.loading ? (
            <InlineLoader label="Loading today's schedule…" />
          ) : appointments.length === 0 ? (
            <EmptyState
              title="No appointments today"
              description="Once patients book, their visits appear here with live status."
              icon={<CalendarIcon />}
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {appointments.map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-16 shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {formatTime(appointment.starts_at)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {appointment.customer?.full_name ?? 'Patient'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {appointment.service?.name ?? 'Service'} ·{' '}
                        {appointment.staff?.full_name ?? 'Staff'}
                        {appointment.customer?.phone ? ` · ${appointment.customer.phone}` : ''}
                      </p>
                    </div>
                  </div>
                  <AppointmentStatusBadge status={appointment.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Low stock alerts"
              description="Restock before you run out."
              actions={
                <Link
                  to="/app/inventory"
                  className="text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  Inventory
                </Link>
              }
            />
            {dashboard.loading ? (
              <InlineLoader label="Checking stock…" />
            ) : (dashboard.data?.lowStock.length ?? 0) === 0 ? (
              <EmptyState title="Stock levels look healthy" description="No items below reorder level." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {dashboard.data?.lowStock.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.quantity} in stock · reorder at {item.reorder_level}
                      </p>
                    </div>
                    <Badge tone={item.quantity === 0 ? 'rose' : 'amber'}>
                      {item.quantity === 0 ? 'Out' : `+${item.units_needed}`}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Expiring soon" description="Within the next 30 days." />
            {dashboard.loading ? (
              <InlineLoader label="Checking expiry dates…" />
            ) : (dashboard.data?.expiring.length ?? 0) === 0 ? (
              <EmptyState title="Nothing expiring soon" description="All batches are within date." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {dashboard.data?.expiring.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Expires {formatDate(item.expiry_date ?? item.created_at)} · {item.quantity}{' '}
                        units
                      </p>
                    </div>
                    <Badge tone={item.days_until_expiry <= 7 ? 'rose' : 'amber'}>
                      {item.days_until_expiry}d
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

