import { useMemo, useState } from 'react';
import { CalendarIcon, SearchIcon } from '../../components/icons';
import {
  AppointmentStatusBadge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  InlineLoader,
  PageHeader,
  Select,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { supabase } from '../../lib/supabase';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_OPTIONS,
  addDays,
  formatDate,
  formatTime,
  getClinicDayRange,
  getErrorMessage,
  todayInClinicTimeZone,
} from '../../lib/utils';
import type { AppointmentStatus, AppointmentWithRelations, Profile } from '../../types/database';

type StaffOption = Pick<Profile, 'id' | 'full_name'>;

export function AppointmentsPage() {
  const toast = useToast();
  const [today] = useState(() => todayInClinicTimeZone());
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(addDays(today, 7));
  const [status, setStatus] = useState<'all' | AppointmentStatus>('all');
  const [staffId, setStaffId] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const staff = useFetch<StaffOption[]>(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['staff', 'owner'])
      .order('full_name')
      .returns<StaffOption[]>();
    if (error) throw error;
    return data ?? [];
  }, []);

  const appointments = useFetch<AppointmentWithRelations[]>(async () => {
    const rangeStart = getClinicDayRange(fromDate).start;
    const rangeEnd = getClinicDayRange(toDate).end;

    let query = supabase
      .from('appointments')
      .select(
        '*, service:services(id, name, duration_minutes, price), staff:profiles!appointments_staff_id_fkey(id, full_name), customer:profiles!appointments_customer_id_fkey(id, full_name, phone)',
      )
      .gte('starts_at', rangeStart)
      .lt('starts_at', rangeEnd)
      .order('starts_at', { ascending: true })
      .limit(300);

    if (status !== 'all') query = query.eq('status', status);
    if (staffId !== 'all') query = query.eq('staff_id', staffId);

    const { data, error } = await query.returns<AppointmentWithRelations[]>();
    if (error) throw error;
    return data ?? [];
  }, [fromDate, toDate, status, staffId]);

  const grouped = useMemo(() => {
    const groups = new Map<string, AppointmentWithRelations[]>();
    for (const appointment of appointments.data ?? []) {
      const day = appointment.starts_at.slice(0, 10);
      const existing = groups.get(day) ?? [];
      existing.push(appointment);
      groups.set(day, existing);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [appointments.data]);

  const updateStatus = async (appointment: AppointmentWithRelations, next: AppointmentStatus) => {
    setUpdatingId(appointment.id);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: next })
        .eq('id', appointment.id);
      if (error) throw error;
      toast.success(`Marked as ${APPOINTMENT_STATUS_LABELS[next].toLowerCase()}`);
      appointments.reload();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update the appointment'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Filter the schedule, confirm requests and record outcomes."
      />

      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="from-date" className="field-label">
              From
            </label>
            <input
              id="from-date"
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div>
            <label htmlFor="to-date" className="field-label">
              To
            </label>
            <input
              id="to-date"
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <Select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value as 'all' | AppointmentStatus)}
          >
            <option value="all">All statuses</option>
            {APPOINTMENT_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {APPOINTMENT_STATUS_LABELS[option]}
              </option>
            ))}
          </Select>
          <Select
            label="Practitioner"
            value={staffId}
            onChange={(event) => setStaffId(event.target.value)}
          >
            <option value="all">All practitioners</option>
            {(staff.data ?? []).map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {appointments.data?.length ?? 0} appointments · times in clinic timezone
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFromDate(today);
              setToDate(addDays(today, 7));
              setStatus('all');
              setStaffId('all');
            }}
          >
            Reset filters
          </Button>
        </div>
      </Card>

      {appointments.loading ? (
        <Card>
          <InlineLoader label="Loading schedule…" />
        </Card>
      ) : appointments.error ? (
        <Card className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
          <p className="text-sm text-rose-600 dark:text-rose-400">{appointments.error}</p>
          <Button size="sm" variant="outline" onClick={appointments.reload}>
            Try again
          </Button>
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <EmptyState
            title="No appointments match these filters"
            description="Try a wider date range or a different status."
            icon={<CalendarIcon />}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, items]) => (
            <Card key={day}>
              <CardHeader
                title={formatDate(day)}
                description={`${items.length} appointment${items.length === 1 ? '' : 's'}`}
              />
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead className="table-head">
                    <tr>
                      <th className="px-5 py-3">Time</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Service</th>
                      <th className="px-5 py-3">Practitioner</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((appointment) => (
                      <tr
                        key={appointment.id}
                        className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {formatTime(appointment.starts_at)}
                          <span className="block text-xs font-normal text-slate-400">
                            until {formatTime(appointment.ends_at)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {appointment.customer?.full_name ?? 'Patient'}
                          </p>
                          {appointment.customer?.phone ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {appointment.customer.phone}
                            </p>
                          ) : null}
                          {appointment.notes ? (
                            <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
                              “{appointment.notes}”
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {appointment.service?.name ?? '—'}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {appointment.staff?.full_name ?? '—'}
                        </td>
                        <td className="px-5 py-4">
                          <AppointmentStatusBadge status={appointment.status} />
                        </td>
                        <td className="px-5 py-4">
                          <label className="sr-only" htmlFor={`status-${appointment.id}`}>
                            Update status for {appointment.customer?.full_name ?? 'appointment'}
                          </label>
                          <select
                            id={`status-${appointment.id}`}
                            value={appointment.status}
                            disabled={updatingId === appointment.id}
                            onChange={(event) =>
                              void updateStatus(
                                appointment,
                                event.target.value as AppointmentStatus,
                              )
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900"
                          >
                            {APPOINTMENT_STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {APPOINTMENT_STATUS_LABELS[option]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
        <SearchIcon className="h-3.5 w-3.5" />
        Every status change is recorded in the audit log.
      </p>
    </div>
  );
}
