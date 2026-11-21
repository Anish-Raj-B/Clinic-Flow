import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarIcon, ClockIcon, PlusIcon } from '../../components/icons';
import {
  AppointmentStatusBadge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  InlineLoader,
  Modal,
  PageHeader,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { supabase } from '../../lib/supabase';
import {
  formatCurrency,
  formatDate,
  formatTime,
  getErrorMessage,
} from '../../lib/utils';
import type { AppointmentWithRelations } from '../../types/database';

const ACTIVE_STATUSES = new Set(['pending', 'confirmed']);

export function MyAppointmentsPage() {
  const toast = useToast();
  const [cancelTarget, setCancelTarget] = useState<AppointmentWithRelations | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const appointments = useFetch<AppointmentWithRelations[]>(async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select(
        '*, service:services(id, name, duration_minutes, price), staff:profiles!appointments_staff_id_fkey(id, full_name), customer:profiles!appointments_customer_id_fkey(id, full_name, phone)',
      )
      .order('starts_at', { ascending: false })
      .returns<AppointmentWithRelations[]>();
    if (error) throw error;
    return data ?? [];
  }, []);

  const now = Date.now();
  const upcoming =
    appointments.data?.filter(
      (appointment) =>
        ACTIVE_STATUSES.has(appointment.status) && new Date(appointment.starts_at).getTime() >= now,
    ) ?? [];
  const upcomingIds = new Set(upcoming.map((appointment) => appointment.id));
  const history = (appointments.data ?? []).filter(
    (appointment) => !upcomingIds.has(appointment.id),
  );

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const { error } = await supabase.rpc('cancel_appointment', {
        p_appointment_id: cancelTarget.id,
      });
      if (error) throw error;
      toast.success('Appointment cancelled');
      setCancelTarget(null);
      appointments.reload();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not cancel the appointment'));
    } finally {
      setCancelling(false);
    }
  };

  const renderRow = (appointment: AppointmentWithRelations, allowCancel: boolean) => (
    <li
      key={appointment.id}
      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-4">
        <div className="flex w-16 shrink-0 flex-col rounded-xl bg-brand-50 px-2 py-2 text-center dark:bg-brand-500/10">
          <span className="text-xs font-semibold uppercase text-brand-700 dark:text-brand-300">
            {formatDate(appointment.starts_at).split(' ')[0]}
          </span>
          <span className="text-lg font-bold text-brand-900 dark:text-brand-100">
            {formatDate(appointment.starts_at).split(' ')[1]?.replace(',', '')}
          </span>
          <span className="text-[11px] text-brand-700 dark:text-brand-300">
            {formatTime(appointment.starts_at)}
          </span>
        </div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {appointment.service?.name ?? 'Appointment'}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5" />
              {formatTime(appointment.starts_at)} – {formatTime(appointment.ends_at)}
            </span>
            <span>with {appointment.staff?.full_name ?? 'clinic team'}</span>
            {appointment.service ? (
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {formatCurrency(appointment.service.price)}
              </span>
            ) : null}
          </p>
          {appointment.notes ? (
            <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
              Note: {appointment.notes}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
        <AppointmentStatusBadge status={appointment.status} />
        {allowCancel ? (
          <Button
            size="sm"
            variant="outline"
            className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
            onClick={() => setCancelTarget(appointment)}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="My appointments"
        description="Upcoming visits and your appointment history."
        actions={
          <Link to="/app/book">
            <Button>
              <PlusIcon className="h-4 w-4" />
              Book appointment
            </Button>
          </Link>
        }
      />

      {appointments.loading ? (
        <Card>
          <InlineLoader label="Loading your appointments…" />
        </Card>
      ) : appointments.error ? (
        <Card className="p-5">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-rose-600 dark:text-rose-400">{appointments.error}</p>
            <Button variant="outline" size="sm" onClick={appointments.reload}>
              Try again
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Upcoming"
              description={`${upcoming.length} appointment${upcoming.length === 1 ? '' : 's'} scheduled`}
            />
            {upcoming.length === 0 ? (
              <EmptyState
                title="Nothing booked yet"
                description="Book your first visit and it will show up here."
                icon={<CalendarIcon />}
                action={
                  <Link to="/app/book">
                    <Button size="sm">Book an appointment</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {upcoming.map((appointment) => renderRow(appointment, true))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="History" description="Past and cancelled appointments." />
            {history.length === 0 ? (
              <EmptyState title="No past appointments" description="Your history will appear here." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((appointment) => renderRow(appointment, false))}
              </ul>
            )}
          </Card>
        </>
      )}

      <Modal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Cancel this appointment?"
        description="The slot will be released for other patients immediately."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Keep it
            </Button>
            <Button variant="danger" loading={cancelling} onClick={() => void handleCancel()}>
              Cancel appointment
            </Button>
          </>
        }
      >
        {cancelTarget ? (
          <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/50">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {cancelTarget.service?.name ?? 'Appointment'}
            </p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              {formatDate(cancelTarget.starts_at)} at {formatTime(cancelTarget.starts_at)} with{' '}
              {cancelTarget.staff?.full_name ?? 'the clinic team'}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
