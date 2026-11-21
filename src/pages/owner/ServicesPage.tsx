import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ClockIcon, PlusIcon, SettingsIcon } from '../../components/icons';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  InlineLoader,
  Input,
  Modal,
  PageHeader,
  Textarea,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { serviceSchema, type ServiceValues } from '../../lib/schemas';
import { supabase } from '../../lib/supabase';
import { formatCurrency, getErrorMessage } from '../../lib/utils';
import type { Service } from '../../types/database';

const DEFAULT_SERVICE: ServiceValues = {
  name: '',
  description: '',
  durationMinutes: 30,
  price: 0,
  active: true,
};

function friendlyServiceError(message: string): string {
  if (message.toLowerCase().includes('foreign key')) {
    return 'This service is linked to existing appointments. Deactivate it instead of deleting.';
  }
  return message;
}

export function ServicesPage() {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);

  const services = useFetch<Service[]>(async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('active', { ascending: false })
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }, []);

  const form = useForm<ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: DEFAULT_SERVICE,
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(DEFAULT_SERVICE);
    setModalOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditing(service);
    form.reset({
      name: service.name,
      description: service.description ?? '',
      durationMinutes: service.duration_minutes,
      price: service.price,
      active: service.active,
    });
    setModalOpen(true);
  };

  const submit = async (values: ServiceValues) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        duration_minutes: values.durationMinutes,
        price: values.price,
        active: values.active,
      };
      if (editing) {
        const { error } = await supabase.from('services').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Service updated');
      } else {
        const { error } = await supabase.from('services').insert(payload);
        if (error) throw error;
        toast.success('Service created');
      }
      setModalOpen(false);
      services.reload();
    } catch (error) {
      toast.error(friendlyServiceError(getErrorMessage(error, 'Could not save the service')));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (service: Service) => {
    setTogglingId(service.id);
    try {
      const { error } = await supabase
        .from('services')
        .update({ active: !service.active })
        .eq('id', service.id);
      if (error) throw error;
      toast.success(service.active ? 'Service deactivated' : 'Service activated');
      services.reload();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update the service'));
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('services').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Service deleted');
      setDeleteTarget(null);
      services.reload();
    } catch (error) {
      toast.error(friendlyServiceError(getErrorMessage(error, 'Could not delete the service')));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Define what patients can book, how long it takes and what it costs."
        actions={
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4" />
            New service
          </Button>
        }
      />

      <Card>
        {services.loading ? (
          <InlineLoader label="Loading services…" />
        ) : services.error ? (
          <div className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <p className="text-sm text-rose-600 dark:text-rose-400">{services.error}</p>
            <Button size="sm" variant="outline" onClick={services.reload}>
              Try again
            </Button>
          </div>
        ) : !services.data || services.data.length === 0 ? (
          <EmptyState
            title="No services yet"
            description="Create your first bookable service to open the booking flow."
            icon={<SettingsIcon />}
            action={<Button size="sm" onClick={openCreate}>New service</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {services.data.map((service) => (
                  <tr key={service.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {service.name}
                      </p>
                      {service.description ? (
                        <p className="mt-0.5 max-w-md text-xs text-slate-500 dark:text-slate-400">
                          {service.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {service.duration_minutes} min
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(service.price)}
                    </td>
                    <td className="px-5 py-4">
                      {service.active ? (
                        <Badge tone="emerald">Bookable</Badge>
                      ) : (
                        <Badge tone="slate">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          loading={togglingId === service.id}
                          onClick={() => void toggleActive(service)}
                        >
                          {service.active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(service)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                          onClick={() => setDeleteTarget(service)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit service' : 'New service'}
        description="Duration drives slot generation; price is used for invoicing."
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="service-form" loading={saving}>
              {editing ? 'Save changes' : 'Create service'}
            </Button>
          </>
        }
      >
        <form id="service-form" onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
          <Input
            label="Service name"
            placeholder="General consultation"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <Textarea
            label="Description (optional)"
            placeholder="What patients can expect…"
            error={form.formState.errors.description?.message}
            {...form.register('description')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Duration (minutes)"
              type="number"
              min={5}
              max={480}
              step={5}
              error={form.formState.errors.durationMinutes?.message}
              {...form.register('durationMinutes', { valueAsNumber: true })}
            />
            <Input
              label="Price"
              type="number"
              min={0}
              step="0.01"
              error={form.formState.errors.price?.message}
              {...form.register('price', { valueAsNumber: true })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              {...form.register('active')}
            />
            Active and bookable by customers
          </label>
        </form>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete service?"
        description="Services used by past appointments cannot be deleted - deactivate them instead."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void confirmDelete()}>
              Delete service
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
