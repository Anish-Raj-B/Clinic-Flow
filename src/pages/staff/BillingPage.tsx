import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { DownloadIcon, PlusIcon, ReceiptIcon, TrashIcon } from '../../components/icons';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  InlineLoader,
  Input,
  InvoiceStatusBadge,
  Modal,
  PageHeader,
  Select,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { invoiceSchema, type InvoiceValues } from '../../lib/schemas';
import { supabase } from '../../lib/supabase';
import {
  computeInvoiceTotals,
  formatCurrency,
  formatDate,
  formatInvoiceNumber,
  formatTime,
  getErrorMessage,
} from '../../lib/utils';
import type { AppointmentStatus, InvoiceStatus, InvoiceWithRelations } from '../../types/database';

interface CustomerOption {
  id: string;
  full_name: string;
}

interface AppointmentOption {
  id: string;
  starts_at: string;
  customer_id: string;
  status: AppointmentStatus;
  service: { id: string; name: string; price: number } | null;
  customer: { id: string; full_name: string } | null;
}

interface BillingData {
  invoices: InvoiceWithRelations[];
  customers: CustomerOption[];
  appointments: AppointmentOption[];
}

const DEFAULT_INVOICE: InvoiceValues = {
  customerId: '',
  appointmentId: '',
  taxRate: 0,
  items: [{ description: '', quantity: 1, unitPrice: 0 }],
};

export function BillingPage() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const data = useFetch<BillingData>(async () => {
    const [invoices, customers, appointments] = await Promise.all([
      supabase
        .from('invoices')
        .select(
          '*, customer:profiles!invoices_customer_id_fkey(id, full_name, phone), appointment:appointments!invoices_appointment_id_fkey(id, starts_at), invoice_items(*)',
        )
        .order('created_at', { ascending: false })
        .limit(300)
        .returns<InvoiceWithRelations[]>(),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'customer')
        .order('full_name')
        .returns<CustomerOption[]>(),
      supabase
        .from('appointments')
        .select(
          'id, starts_at, customer_id, status, service:services(id, name, price), customer:profiles!appointments_customer_id_fkey(id, full_name)',
        )
        .order('starts_at', { ascending: false })
        .limit(300)
        .returns<AppointmentOption[]>(),
    ]);

    if (invoices.error) throw invoices.error;
    if (customers.error) throw customers.error;
    if (appointments.error) throw appointments.error;

    return {
      invoices: invoices.data ?? [],
      customers: customers.data ?? [],
      appointments: appointments.data ?? [],
    };
  }, []);

  const form = useForm<InvoiceValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: DEFAULT_INVOICE,
  });
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = form.watch('items');
  const watchedTax = form.watch('taxRate');
  const totals = useMemo(
    () =>
      computeInvoiceTotals(
        (watchedItems ?? []).map((item) => ({
          quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
          unitPrice: Number.isFinite(item.unitPrice) ? item.unitPrice : 0,
        })),
        Number.isFinite(watchedTax) ? watchedTax : 0,
      ),
    [watchedItems, watchedTax],
  );

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data.data?.invoices ?? []).filter((invoice) => {
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
      const matchesTerm =
        term.length === 0 ||
        formatInvoiceNumber(invoice.id).toLowerCase().includes(term) ||
        (invoice.customer?.full_name ?? '').toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [data.data?.invoices, statusFilter, search]);

  const openCreate = () => {
    form.reset(DEFAULT_INVOICE);
    setCreateOpen(true);
  };

  const handleAppointmentChange = (appointmentId: string) => {
    form.setValue('appointmentId', appointmentId);
    const appointment = data.data?.appointments.find((item) => item.id === appointmentId);
    if (!appointment) return;
    form.setValue('customerId', appointment.customer_id, { shouldValidate: true });
    if (appointment.service) {
      replace([
        {
          description: appointment.service.name,
          quantity: 1,
          unitPrice: appointment.service.price,
        },
      ]);
    }
  };

  const submitInvoice = async (values: InvoiceValues) => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('create_invoice', {
        p_customer_id: values.customerId,
        p_appointment_id: values.appointmentId ? values.appointmentId : null,
        p_tax_rate: values.taxRate,
        p_items: values.items.map((item) => ({
          description: item.description.trim(),
          quantity: item.quantity,
          unit_price: item.unitPrice,
        })),
      });
      if (error) throw error;
      toast.success('Invoice created');
      setCreateOpen(false);
      data.reload();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not create the invoice'));
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (invoice: InvoiceWithRelations) => {
    setPayingId(invoice.id);
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'paid' })
        .eq('id', invoice.id);
      if (error) throw error;
      toast.success(`${formatInvoiceNumber(invoice.id)} marked as paid`);
      data.reload();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update the invoice'));
    } finally {
      setPayingId(null);
    }
  };

  const downloadPdf = async (invoice: InvoiceWithRelations) => {
    try {
      // jsPDF is large; load it only when a PDF is actually requested.
      const { downloadInvoicePdf } = await import('../../lib/pdf');
      downloadInvoicePdf({
        invoice,
        items: invoice.invoice_items,
        customer: invoice.customer,
      });
      toast.success('Invoice PDF downloaded');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not generate the PDF'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Create invoices from visits, collect payment and issue PDF receipts."
        actions={
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4" />
            New invoice
          </Button>
        }
      />

      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <div>
            <label htmlFor="invoice-search" className="field-label">
              Search
            </label>
            <input
              id="invoice-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Invoice number or customer…"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <Select
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | InvoiceStatus)}
          >
            <option value="all">All invoices</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
          </Select>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Invoices"
          description={`${filteredInvoices.length} shown · ${formatCurrency(
            filteredInvoices.filter((invoice) => invoice.status === 'paid').reduce(
              (sum, invoice) => sum + invoice.total,
              0,
            ),
          )} collected`}
        />
        {data.loading ? (
          <InlineLoader label="Loading invoices…" />
        ) : data.error ? (
          <div className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <p className="text-sm text-rose-600 dark:text-rose-400">{data.error}</p>
            <Button size="sm" variant="outline" onClick={data.reload}>
              Try again
            </Button>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <EmptyState
            title="No invoices here"
            description="Create an invoice after a completed visit, or adjust your filters."
            icon={<ReceiptIcon />}
            action={
              <Button size="sm" onClick={openCreate}>
                Create invoice
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Issued</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-5 py-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatInvoiceNumber(invoice.id)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {invoice.invoice_items.length} line item
                        {invoice.invoice_items.length === 1 ? '' : 's'}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {invoice.customer?.full_name ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {formatDate(invoice.created_at)}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="px-5 py-4">
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {invoice.status === 'unpaid' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={payingId === invoice.id}
                            onClick={() => void markPaid(invoice)}
                          >
                            Mark paid
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => void downloadPdf(invoice)}>
                          <DownloadIcon className="h-4 w-4" />
                          PDF
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
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create invoice"
        description="Link an appointment for convenience, or invoice a customer directly."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="invoice-form" loading={saving}>
              Create invoice · {formatCurrency(totals.total)}
            </Button>
          </>
        }
      >
        <form
          id="invoice-form"
          onSubmit={form.handleSubmit(submitInvoice)}
          className="space-y-5"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Appointment (optional)"
              value={form.watch('appointmentId') ?? ''}
              onChange={(event) => handleAppointmentChange(event.target.value)}
            >
              <option value="">No appointment</option>
              {(data.data?.appointments ?? []).map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {formatDate(appointment.starts_at)} · {formatTime(appointment.starts_at)} ·{' '}
                  {appointment.customer?.full_name ?? 'Customer'}
                </option>
              ))}
            </Select>
            <Select
              label="Customer"
              error={form.formState.errors.customerId?.message}
              {...form.register('customerId')}
            >
              <option value="">Select a customer</option>
              {(data.data?.customers ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Line items
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
              >
                <PlusIcon className="h-4 w-4" />
                Add line
              </Button>
            </div>
            {form.formState.errors.items?.root?.message ? (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {form.formState.errors.items.root.message}
              </p>
            ) : null}
            <div className="mt-3 space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_90px_130px_auto] dark:border-slate-700"
                >
                  <Input
                    label={index === 0 ? 'Description' : undefined}
                    aria-label={`Description for line ${index + 1}`}
                    placeholder="Consultation, medication…"
                    error={form.formState.errors.items?.[index]?.description?.message}
                    {...form.register(`items.${index}.description` as const)}
                  />
                  <Input
                    label={index === 0 ? 'Qty' : undefined}
                    aria-label={`Quantity for line ${index + 1}`}
                    type="number"
                    min={1}
                    step={1}
                    error={form.formState.errors.items?.[index]?.quantity?.message}
                    {...form.register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                  />
                  <Input
                    label={index === 0 ? 'Unit price' : undefined}
                    aria-label={`Unit price for line ${index + 1}`}
                    type="number"
                    min={0}
                    step="0.01"
                    error={form.formState.errors.items?.[index]?.unitPrice?.message}
                    {...form.register(`items.${index}.unitPrice` as const, { valueAsNumber: true })}
                  />
                  <div className={index === 0 ? 'flex items-end pb-1' : 'flex items-end pb-1'}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      aria-label={`Remove line ${index + 1}`}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {form.formState.errors.items?.message ? (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {form.formState.errors.items.message}
              </p>
            ) : null}

          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:max-w-[180px]">
              <Input
                label="Tax rate (%)"
                type="number"
                min={0}
                max={100}
                step="0.01"
                error={form.formState.errors.taxRate?.message}
                {...form.register('taxRate', { valueAsNumber: true })}
              />
            </div>
            <dl className="w-full max-w-xs space-y-1 text-sm sm:text-right">
              <div className="flex justify-between gap-6">
                <dt className="text-slate-500 dark:text-slate-400">Subtotal</dt>
                <dd className="font-medium">{formatCurrency(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-slate-500 dark:text-slate-400">Tax</dt>
                <dd className="font-medium">{formatCurrency(totals.tax)}</dd>
              </div>
              <div className="flex justify-between gap-6 border-t border-slate-200 pt-1 text-base font-bold dark:border-slate-700">
                <dt>Total</dt>
                <dd>{formatCurrency(totals.total)}</dd>
              </div>
            </dl>
          </div>
        </form>
      </Modal>
    </div>
  );
}
