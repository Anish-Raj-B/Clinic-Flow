import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { PlusIcon, ShieldIcon, TrashIcon, UsersIcon } from '../../components/icons';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  InlineLoader,
  Input,
  Modal,
  PageHeader,
  RoleBadge,
  Select,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { availabilitySchema, type AvailabilityValues } from '../../lib/schemas';
import { supabase } from '../../lib/supabase';
import {
  WEEKDAY_LABELS,
  formatDate,
  getErrorMessage,
  initials,
  ROLE_LABELS,
} from '../../lib/utils';
import type { Profile, StaffAvailability, UserRole } from '../../types/database';

interface StaffData {
  profiles: Profile[];
  availability: StaffAvailability[];
}

const ROLES: UserRole[] = ['customer', 'staff', 'owner'];

function friendlyRoleError(message: string): string {
  if (message.toLowerCase().includes('your own role')) {
    return 'You cannot change your own role. Ask another owner to do it.';
  }
  if (message.toLowerCase().includes('only owners')) {
    return 'Only owners can change roles.';
  }
  return message;
}

export function StaffPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [availabilityStaff, setAvailabilityStaff] = useState<Profile | null>(null);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const data = useFetch<StaffData>(async () => {
    const [profiles, availability] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name', { ascending: true }),
      supabase.from('staff_availability').select('*').order('weekday', { ascending: true }),
    ]);
    if (profiles.error) throw profiles.error;
    if (availability.error) throw availability.error;
    return { profiles: profiles.data ?? [], availability: availability.data ?? [] };
  }, []);

  const availabilityForm = useForm<AvailabilityValues>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: { weekday: 1, startTime: '09:00', endTime: '17:00' },
  });

  const filteredProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data.data?.profiles ?? [];
    return (data.data?.profiles ?? []).filter(
      (profile) =>
        profile.full_name.toLowerCase().includes(term) ||
        (profile.phone ?? '').toLowerCase().includes(term) ||
        profile.role.toLowerCase().includes(term),
    );
  }, [data.data?.profiles, search]);

  const staffAvailability = useMemo(() => {
    if (!availabilityStaff || !data.data) return [];
    return data.data.availability
      .filter((block) => block.staff_id === availabilityStaff.id)
      .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
  }, [availabilityStaff, data.data]);

  const changeRole = async (profile: Profile, nextRole: UserRole) => {
    if (profile.role === nextRole) return;
    setUpdatingId(profile.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: nextRole })
        .eq('id', profile.id);
      if (error) throw error;
      toast.success(`${profile.full_name} is now ${ROLE_LABELS[nextRole].toLowerCase()}`);
      data.reload();
    } catch (error) {
      toast.error(friendlyRoleError(getErrorMessage(error, 'Could not change the role')));
    } finally {
      setUpdatingId(null);
    }
  };

  const addAvailability = async (values: AvailabilityValues) => {
    if (!availabilityStaff) return;
    setSavingAvailability(true);
    try {
      // Browsers may return "09:00" or "09:00:00"; normalise to a SQL time.
      const startTime = `${values.startTime.slice(0, 5)}:00`;
      const endTime = `${values.endTime.slice(0, 5)}:00`;
      const { error } = await supabase.from('staff_availability').insert({
        staff_id: availabilityStaff.id,
        weekday: values.weekday,
        start_time: startTime,
        end_time: endTime,
      });
      if (error) throw error;
      toast.success('Availability block added');
      availabilityForm.reset({
        weekday: values.weekday,
        startTime: '09:00',
        endTime: '17:00',
      });
      data.reload();
    } catch (error) {
      const message = getErrorMessage(error, 'Could not add availability');
      toast.error(
        message.toLowerCase().includes('duplicate')
          ? 'This practitioner already has a block starting at that time on that day.'
          : message,
      );
    } finally {
      setSavingAvailability(false);
    }
  };

  const removeAvailability = async (block: StaffAvailability) => {
    setRemovingId(block.id);
    try {
      const { error } = await supabase.from('staff_availability').delete().eq('id', block.id);
      if (error) throw error;
      toast.success('Availability block removed');
      data.reload();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not remove availability'));
    } finally {
      setRemovingId(null);
    }
  };

  const openAvailability = (profile: Profile) => {
    setAvailabilityStaff(profile);
    availabilityForm.reset({ weekday: 1, startTime: '09:00', endTime: '17:00' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & roles"
        description="Promote team members and maintain the weekly availability used for booking."
      />

      <Card className="p-4 sm:p-5">
        <div>
          <label htmlFor="staff-search" className="field-label">
            Search people
          </label>
          <input
            id="staff-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, phone or role…"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <ShieldIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          New signups are always customers. Owners can promote to staff or owner; nobody can change
          their own role, and all role changes are audited.
        </p>
      </Card>

      <Card>
        <CardHeader title="People" description={`${filteredProfiles.length} accounts`} />
        {data.loading ? (
          <InlineLoader label="Loading people…" />
        ) : data.error ? (
          <div className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <p className="text-sm text-rose-600 dark:text-rose-400">{data.error}</p>
            <Button size="sm" variant="outline" onClick={data.reload}>
              Try again
            </Button>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <EmptyState
            title="No accounts found"
            description="Adjust the search to find a team member."
            icon={<UsersIcon />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3">Person</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Joined</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3 text-right">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProfiles.map((profile) => {
                  const isSelf = profile.id === user?.id;
                  const blocks = (data.data?.availability ?? []).filter(
                    (block) => block.staff_id === profile.id,
                  ).length;
                  return (
                    <tr key={profile.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-500/15 dark:text-brand-300">
                            {initials(profile.full_name)}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {profile.full_name}
                              {isSelf ? (
                                <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>
                              ) : null}
                            </p>
                            <div className="mt-1">
                              <RoleBadge role={profile.role} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {profile.phone ?? '—'}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {formatDate(profile.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <label className="sr-only" htmlFor={`role-${profile.id}`}>
                          Role for {profile.full_name}
                        </label>
                        <select
                          id={`role-${profile.id}`}
                          value={profile.role}
                          disabled={isSelf || updatingId === profile.id}
                          onChange={(event) =>
                            void changeRole(profile, event.target.value as UserRole)
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <Badge tone={blocks > 0 ? 'brand' : 'slate'}>
                            {blocks} block{blocks === 1 ? '' : 's'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAvailability(profile)}
                            disabled={profile.role === 'customer'}
                          >
                            Manage hours
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={availabilityStaff !== null}
        onClose={() => setAvailabilityStaff(null)}
        title={`Availability · ${availabilityStaff?.full_name ?? ''}`}
        description="Weekly recurring hours used to generate bookable time slots."
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setAvailabilityStaff(null)}>
            Done
          </Button>
        }
      >
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Current blocks
            </h3>
            {staffAvailability.length === 0 ? (
              <p className="mt-2 rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                No availability yet. This practitioner cannot be booked until a block is added.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                {staffAvailability.map((block) => (
                  <li
                    key={block.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {WEEKDAY_LABELS[block.weekday] ?? 'Unknown'}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {block.start_time.slice(0, 5)} – {block.end_time.slice(0, 5)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                      loading={removingId === block.id}
                      onClick={() => void removeAvailability(block)}
                      aria-label={`Remove ${WEEKDAY_LABELS[block.weekday]} block`}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={availabilityForm.handleSubmit(addAvailability)} noValidate>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Add a block
            </h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <Select
                label="Weekday"
                error={availabilityForm.formState.errors.weekday?.message}
                {...availabilityForm.register('weekday', { valueAsNumber: true })}
              >
                {WEEKDAY_LABELS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </Select>
              <Input
                label="Start"
                type="time"
                error={availabilityForm.formState.errors.startTime?.message}
                {...availabilityForm.register('startTime')}
              />
              <Input
                label="End"
                type="time"
                error={availabilityForm.formState.errors.endTime?.message}
                {...availabilityForm.register('endTime')}
              />
              <Button type="submit" loading={savingAvailability} className="sm:mb-0">
                <PlusIcon className="h-4 w-4" />
                Add
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
