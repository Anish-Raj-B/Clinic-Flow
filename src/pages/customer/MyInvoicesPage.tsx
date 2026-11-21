import { useState } from 'react';
import { DownloadIcon, FileTextIcon } from '../../components/icons';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  InlineLoader,
  InvoiceStatusBadge,
  Modal,
  PageHeader,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { supabase } from '../../lib/supabase';
import {
  formatCurrency,
  formatDate,
  formatInvoiceNumber,
  getErrorMessage,
} from '../../lib/utils';
import type { InvoiceWithRelations } from '../../types/database';

export function MyInvoicesPage() {
  const toast = useToast();
  const [selected, setSelected] = useState<InvoiceWithRelations | null>(null);

  const invoices = useFetch<InvoiceWithRelations[]>(async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select(
        '*, customer:profiles!invoices_customer_id_fkey(id, full_name, phone), appointment:appointments!invoices_appointment_id_fkey(id, starts_at), invoice_items(*)',
      )
      .order('created_at', { ascending: false })
      .returns<InvoiceWithRelations[]>();
    if (error) throw error;
    return data ?? [];
  }, []);

  const handleDownload = async (invoice: InvoiceWithRelations) => {
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
        title="My invoices"
        description="Download a PDF copy of any invoice for your records."
      />

      <Card>
        <CardHeader title="Invoices" description={`${invoices.data?.length ?? 0} total`} />
        {invoices.loading ? (
          <InlineLoader label="Loading invoices…" />
        ) : invoices.error ? (
          <div className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-rose-600 dark:text-rose-400">{invoices.error}</p>
            <Button variant="outline" size="sm" onClick={invoices.reload}>
              Try again
            </Button>
          </div>
        ) : !invoices.data || invoices.data.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Invoices created after your visits will appear here."
            icon={<FileTextIcon />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Issued</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.data.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-slate-100">
                      {formatInvoiceNumber(invoice.id)}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {formatDate(invoice.created_at)}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="px-5 py-4">
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSelected(invoice)}>
                          View
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleDownload(invoice)}>
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
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? formatInvoiceNumber(selected.id) : 'Invoice'}
        description={selected ? `Issued ${formatDate(selected.created_at)}` : undefined}
        size="lg"
        footer={
          selected ? (
            <>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
              <Button onClick={() => void handleDownload(selected)}>
                <DownloadIcon className="h-4 w-4" />
                Download PDF
              </Button>
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Billed to
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {selected.customer?.full_name ?? 'Customer'}
                </p>
              </div>
              <InvoiceStatusBadge status={selected.status} />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="table-base">
                <thead className="table-head">
                  <tr>
                    <th className="px-4 py-2.5">Description</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Unit price</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selected.invoice_items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                        {item.description}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Subtotal</dt>
                <dd className="font-medium">{formatCurrency(selected.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Tax</dt>
                <dd className="font-medium">{formatCurrency(selected.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold dark:border-slate-700">
                <dt>Total</dt>
                <dd>{formatCurrency(selected.total)}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
