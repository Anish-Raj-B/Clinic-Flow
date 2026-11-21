import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartIcon, CreditCardIcon, CalendarIcon, AlertIcon } from '../../components/icons';
import { Button, Card, CardHeader, InlineLoader, PageHeader, StatCard } from '../../components/ui';
import { useFetch } from '../../hooks/useFetch';
import { supabase } from '../../lib/supabase';
import {
  addDays,
  formatCurrency,
  formatDate,
  getErrorMessage,
  todayInClinicTimeZone,
} from '../../lib/utils';
import type {
  AppointmentStatus,
  BusiestHour,
  DailyRevenue,
  InvoiceStatus,
} from '../../types/database';

interface AppointmentRow {
  id: string;
  status: AppointmentStatus;
  starts_at: string;
}

interface InvoiceRow {
  id: string;
  total: number;
  status: InvoiceStatus;
  created_at: string;
}

interface InvoiceItemRow {
  description: string;
  quantity: number;
  unit_price: number;
  invoice: { id: string; status: InvoiceStatus } | null;
}

interface AnalyticsData {
  revenue: DailyRevenue[];
  hours: BusiestHour[];
  appointments: AppointmentRow[];
  invoices: InvoiceRow[];
  items: InvoiceItemRow[];
}

const CHART_TOOLTIP = {
  backgroundColor: '#0f172a',
  border: 'none',
  borderRadius: 8,
  color: '#f8fafc',
  fontSize: 12,
};

export function AnalyticsPage() {
  const [today] = useState(() => todayInClinicTimeZone());
  const since = useMemo(() => addDays(today, -29), [today]);

  const data = useFetch<AnalyticsData>(async () => {
    const [revenue, hours, appointments, invoices, items] = await Promise.all([
      supabase
        .from('daily_revenue')
        .select('*')
        .gte('day', since)
        .order('day', { ascending: true })
        .returns<DailyRevenue[]>(),
      supabase.from('busiest_hours').select('*').order('hour').returns<BusiestHour[]>(),
      supabase
        .from('appointments')
        .select('id, status, starts_at')
        .gte('starts_at', `${since}T00:00:00.000Z`)
        .limit(2000)
        .returns<AppointmentRow[]>(),
      supabase
        .from('invoices')
        .select('id, total, status, created_at')
        .gte('created_at', `${since}T00:00:00.000Z`)
        .limit(2000)
        .returns<InvoiceRow[]>(),
      supabase
        .from('invoice_items')
        .select('description, quantity, unit_price, invoice:invoices(id, status)')
        .limit(2000)
        .returns<InvoiceItemRow[]>(),
    ]);

    if (revenue.error) throw revenue.error;
    if (hours.error) throw hours.error;
    if (appointments.error) throw appointments.error;
    if (invoices.error) throw invoices.error;
    if (items.error) throw items.error;

    return {
      revenue: revenue.data ?? [],
      hours: hours.data ?? [],
      appointments: appointments.data ?? [],
      invoices: invoices.data ?? [],
      items: items.data ?? [],
    };
  }, [since]);

  const analytics = data.data;

  const totalRevenue = (analytics?.revenue ?? []).reduce(
    (sum, row) => sum + Number(row.revenue),
    0,
  );
  const completedAppointments = (analytics?.appointments ?? []).filter(
    (row) => row.status !== 'cancelled',
  );
  const noShows = completedAppointments.filter((row) => row.status === 'no_show').length;
  const noShowRate =
    completedAppointments.length === 0 ? 0 : (noShows / completedAppointments.length) * 100;
  const paidInvoices = (analytics?.invoices ?? []).filter((row) => row.status === 'paid');
  const averageInvoice =
    paidInvoices.length === 0
      ? 0
      : paidInvoices.reduce((sum, row) => sum + Number(row.total), 0) / paidInvoices.length;

  const topItems = useMemo(() => {
    const map = new Map<string, { quantity: number; revenue: number }>();
    for (const item of analytics?.items ?? []) {
      if (item.invoice?.status !== 'paid') continue;
      const key = item.description;
      const current = map.get(key) ?? { quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.quantity * Number(item.unit_price);
      map.set(key, current);
    }
    return [...map.entries()]
      .map(([description, stats]) => ({ description, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [analytics?.items]);

  const revenueChart = (analytics?.revenue ?? []).map((row) => ({
    day: row.day,
    label: formatDate(row.day),
    revenue: Number(row.revenue),
    invoices: Number(row.invoice_count),
  }));

  const hoursChart = (analytics?.hours ?? []).map((row) => ({
    hour: `${String(row.hour).padStart(2, '0')}:00`,
    appointments: Number(row.appointments),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Revenue, demand and collection health for the last 30 days."
      />

      {data.error ? (
        <Card className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
            <AlertIcon className="h-4 w-4" />
            {data.error || getErrorMessage(null, 'Could not load analytics')}
          </p>
          <Button size="sm" variant="outline" onClick={data.reload}>
            Try again
          </Button>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue (30 days)"
          value={data.loading ? '—' : formatCurrency(totalRevenue)}
          hint={`${paidInvoices.length} paid invoices`}
          icon={<CreditCardIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Appointments"
          value={data.loading ? '—' : completedAppointments.length}
          hint="Cancelled visits excluded"
          tone="accent"
          icon={<CalendarIcon className="h-5 w-5" />}
        />
        <StatCard
          label="No-show rate"
          value={data.loading ? '—' : `${noShowRate.toFixed(1)}%`}
          hint={`${noShows} no-shows recorded`}
          tone={noShowRate > 10 ? 'rose' : 'brand'}
          icon={<AlertIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Average invoice"
          value={data.loading ? '—' : formatCurrency(averageInvoice)}
          hint="Paid invoices only"
          tone="amber"
          icon={<ChartIcon className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader title="Daily revenue" description="Paid invoices grouped by day." />
        {data.loading ? (
          <InlineLoader label="Crunching revenue…" />
        ) : revenueChart.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            No paid invoices in this period yet.
          </p>
        ) : (
          <div className="h-72 w-full px-2 py-4 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChart} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(value: string) =>
                    new Intl.DateTimeFormat('en-US', {
                      month: 'short',
                      day: 'numeric',
                      timeZone: 'UTC',
                    }).format(new Date(`${value}T12:00:00Z`))
                  }
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(value: number) => formatCurrency(value)}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP}
                  labelFormatter={(label) => formatDate(String(label))}
                  formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2278eb"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#2278eb' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Busiest hours" description="All non-cancelled appointments." />
          {data.loading ? (
            <InlineLoader label="Loading demand…" />
          ) : hoursChart.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              Not enough appointment data yet.
            </p>
          ) : (
            <div className="h-64 w-full px-2 py-4 sm:px-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hoursChart} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP}
                    formatter={(value) => [String(value), 'Appointments']}
                  />
                  <Bar dataKey="appointments" fill="#14b596" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Top-selling items" description="By paid revenue in this period." />
          {data.loading ? (
            <InlineLoader label="Ranking items…" />
          ) : topItems.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              Line items from paid invoices will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {topItems.map((item, index) => (
                <li
                  key={item.description}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.description}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.quantity} sold
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(item.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
