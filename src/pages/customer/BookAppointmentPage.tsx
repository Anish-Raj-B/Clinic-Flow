import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertIcon, CalendarIcon, CheckIcon, ClockIcon } from '../../components/icons';
import {
  Button,
  Card,
  EmptyState,
  InlineLoader,
  PageHeader,
  Spinner,
  Textarea,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { APP_CONFIG } from '../../lib/config';
import { bookingSchema } from '../../lib/schemas';
import { partitionSlots } from '../../lib/slots';
import { supabase } from '../../lib/supabase';
import {
  addDays,
  cn,
  formatCurrency,
  formatDateInputLabel,
  formatTime,
  friendlyBookingError,
  getErrorMessage,
  todayInClinicTimeZone,
} from '../../lib/utils';
import type { Profile, Service } from '../../types/database';

type StaffOption = Pick<Profile, 'id' | 'full_name' | 'role'>;

function StepHeading({
  step,
  title,
  description,
  done,
}: {
  step: number;
  title: string;
  description: string;
  done?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          done
            ? 'bg-accent-600 text-white'
            : 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
        )}
        aria-hidden="true"
      >
        {done ? <CheckIcon className="h-4 w-4" /> : step}
      </span>
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
  );
}

export function BookAppointmentPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [today] = useState(() => todayInClinicTimeZone());
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const dateOptions = useMemo(
    () => Array.from({ length: 21 }, (_, index) => addDays(today, index)),
    [today],
  );

  const services = useFetch<Service[]>(async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }, []);

  const staff = useFetch<StaffOption[]>(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['staff', 'owner'])
      .order('full_name', { ascending: true })
      .returns<StaffOption[]>();
    if (error) throw error;
    return data ?? [];
  }, []);

  const slots = useFetch<{ slot_start: string; slot_end: string }[]>(async () => {
    if (!serviceId || !staffId || !date) return [];
    const { data, error } = await supabase.rpc('get_available_slots', {
      p_service_id: serviceId,
      p_staff_id: staffId,
      p_date: date,
    });
    if (error) throw error;
    return data ?? [];
  }, [serviceId, staffId, date]);

  useEffect(() => {
    setSlot('');
  }, [serviceId, staffId, date]);

  const selectedService = services.data?.find((item) => item.id === serviceId) ?? null;
  const selectedStaff = staff.data?.find((item) => item.id === staffId) ?? null;
  const partitions = useMemo(
    () => partitionSlots(slots.data ?? [], APP_CONFIG.timeZone),
    [slots.data],
  );

  const canBook = Boolean(serviceId && staffId && date && slot) && !submitting;

  const handleBook = async () => {
    const parsed = bookingSchema.safeParse({
      serviceId,
      staffId,
      startsAt: slot,
      notes,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please complete every step');
      return;
    }

    setSubmitting(true);
    try {
      const { data: created, error } = await supabase.rpc('book_appointment', {
        p_service_id: serviceId,
        p_staff_id: staffId,
        p_starts_at: slot,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;

      // Email delivery is best effort; the booking is already committed.
      if (created) {
        void supabase.functions
          .invoke('send-booking-confirmation', { body: { appointment_id: created.id } })
          .catch(() => undefined);
      }

      toast.success(
        `Appointment requested for ${formatDateInputLabel(date)} at ${formatTime(slot)}`,
      );
      navigate('/app/my-appointments');
    } catch (error) {
      toast.error(friendlyBookingError(getErrorMessage(error, 'Could not book this slot')));
      slots.reload();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Book an appointment"
        description={`Choose a service, practitioner and a free time with ${APP_CONFIG.clinicName}.`}
      />

      <Card className="p-5 sm:p-6">
        <StepHeading
          step={1}
          title="Choose a service"
          description="Prices and durations are set by the clinic."
          done={Boolean(selectedService)}
        />
        {services.loading ? (
          <InlineLoader label="Loading services…" />
        ) : services.error ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            <span>{services.error}</span>
            <Button size="sm" variant="outline" onClick={services.reload}>
              Retry
            </Button>
          </div>
        ) : !services.data || services.data.length === 0 ? (
          <EmptyState
            title="No services available yet"
            description="Ask the clinic owner to publish bookable services."
            icon={<CalendarIcon />}
          />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.data.map((service) => {
              const active = service.id === serviceId;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setServiceId(service.id)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-xl border p-4 text-left transition focus-visible:ring-2',
                    active
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:border-brand-400 dark:bg-brand-500/10'
                      : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/50 dark:hover:bg-slate-800',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{service.name}</p>
                    <span className="shrink-0 text-sm font-semibold text-brand-700 dark:text-brand-300">
                      {formatCurrency(service.price)}
                    </span>
                  </div>
                  {service.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                      {service.description}
                    </p>
                  ) : null}
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <ClockIcon className="h-3.5 w-3.5" />
                    {service.duration_minutes} minutes
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <StepHeading
          step={2}
          title="Choose a practitioner"
          description="Slots depend on the practitioner's weekly availability."
          done={Boolean(selectedStaff)}
        />
        {staff.loading ? (
          <InlineLoader label="Loading team…" />
        ) : staff.error ? (
          <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{staff.error}</p>
        ) : !staff.data || staff.data.length === 0 ? (
          <EmptyState
            title="No practitioners available"
            description="The clinic has not added staff yet."
            icon={<CalendarIcon />}
          />
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            {staff.data.map((member) => {
              const active = member.id === staffId;
              return (
                <button
                  key={member.id}
                  type="button"
                  disabled={!serviceId}
                  onClick={() => setStaffId(member.id)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left text-sm font-semibold transition focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-500 dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-200'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
                  )}
                >
                  {member.full_name}
                  <span className="ml-2 text-xs font-normal capitalize text-slate-500 dark:text-slate-400">
                    {member.role}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {!serviceId ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Select a service first to pick a practitioner.
          </p>
        ) : null}
      </Card>

      <Card className="p-5 sm:p-6">
        <StepHeading
          step={3}
          title="Pick a date and time"
          description="Only genuinely free slots are shown."
          done={Boolean(slot)}
        />
        <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {dateOptions.map((option) => {
            const active = option === date;
            const dayNumber = Number(option.slice(8, 10));
            const weekday = formatDateInputLabel(option).split(',')[0] ?? '';
            return (
              <button
                key={option}
                type="button"
                disabled={!staffId}
                onClick={() => setDate(option)}
                aria-pressed={active}
                aria-label={formatDateInputLabel(option)}
                className={cn(
                  'flex min-w-[64px] flex-col items-center rounded-xl border px-3 py-2 transition focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
                  active
                    ? 'border-brand-500 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
                )}
              >
                <span className="text-[11px] font-medium uppercase opacity-80">{weekday}</span>
                <span className="text-lg font-bold">{dayNumber}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {!staffId || !date ? (
            <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              Select a practitioner and a date to see available times.
            </p>
          ) : slots.loading ? (
            <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-500 dark:text-slate-400">
              <Spinner /> Checking live availability…
            </div>
          ) : slots.error ? (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between">
              <span>{slots.error}</span>
              <Button size="sm" variant="outline" onClick={slots.reload}>
                Retry
              </Button>
            </div>
          ) : (slots.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No free slots on this day"
              description="Try another date or practitioner. Availability is updated in real time."
              icon={<CalendarIcon />}
            />
          ) : (
            <div className="space-y-5">
              {[
                { key: 'morning', label: 'Morning', items: partitions.morning },
                { key: 'afternoon', label: 'Afternoon', items: partitions.afternoon },
                { key: 'evening', label: 'Evening', items: partitions.evening },
              ]
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.key}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((available) => {
                        const active = available.slot_start === slot;
                        return (
                          <button
                            key={available.slot_start}
                            type="button"
                            onClick={() => setSlot(available.slot_start)}
                            aria-pressed={active}
                            className={cn(
                              'rounded-lg border px-3.5 py-2 text-sm font-semibold transition focus-visible:ring-2',
                              active
                                ? 'border-accent-600 bg-accent-600 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-accent-400 hover:bg-accent-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
                            )}
                          >
                            {formatTime(available.slot_start)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <StepHeading
          step={4}
          title="Confirm your booking"
          description="Add optional notes for the team, then submit."
          done={false}
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div>
            <Textarea
              label="Notes for the clinic (optional)"
              placeholder="Symptoms, preferred language, accessibility needs…"
              maxLength={1000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              hint={`${notes.length}/1000 characters`}
            />
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Summary
            </p>
            <dl className="mt-2 space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Patient</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {profile?.full_name ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Service</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                  {selectedService?.name ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Practitioner</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {selectedStaff?.full_name ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">When</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                  {slot && date ? `${formatDateInputLabel(date)} · ${formatTime(slot)}` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-1.5 dark:border-slate-700">
                <dt className="text-slate-500 dark:text-slate-400">Price</dt>
                <dd className="font-semibold text-brand-700 dark:text-brand-300">
                  {selectedService ? formatCurrency(selectedService.price) : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="mt-5 flex flex-col items-start gap-2">
          <Button size="lg" onClick={() => void handleBook()} disabled={!canBook} loading={submitting}>
            Request appointment
          </Button>
          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <AlertIcon className="h-3.5 w-3.5" />
            You can cancel from “My appointments”. The clinic confirms each request.
          </p>
        </div>
      </Card>
    </div>
  );
}
