import { useMemo, useState } from 'react';
import { ShieldIcon } from '../../components/icons';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  InlineLoader,
  PageHeader,
  Select,
} from '../../components/ui';
import { useFetch } from '../../hooks/useFetch';
import { supabase } from '../../lib/supabase';
import { formatDateTime, getErrorMessage } from '../../lib/utils';
import type { AuditLog, UserRole } from '../../types/database';

interface AuditLogWithUser extends AuditLog {
  user: { id: string; full_name: string; role: UserRole } | null;
}

const TABLES = ['appointments', 'inventory_items', 'invoices', 'profiles'] as const;
const ACTIONS = ['INSERT', 'UPDATE', 'DELETE'] as const;

function actionTone(action: string): 'emerald' | 'brand' | 'rose' | 'slate' {
  if (action === 'INSERT') return 'emerald';
  if (action === 'UPDATE') return 'brand';
  if (action === 'DELETE') return 'rose';
  return 'slate';
}

export function AuditLogsPage() {
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const logs = useFetch<AuditLogWithUser[]>(async () => {
    let query = supabase
      .from('audit_logs')
      .select('*, user:profiles!audit_logs_user_id_fkey(id, full_name, role)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (tableFilter !== 'all') query = query.eq('table_name', tableFilter);
    if (actionFilter !== 'all') query = query.eq('action', actionFilter);

    const { data, error } = await query.returns<AuditLogWithUser[]>();
    if (error) throw error;
    return data ?? [];
  }, [tableFilter, actionFilter]);

  const summary = useMemo(() => {
    const rows = logs.data ?? [];
    return {
      total: rows.length,
      inserts: rows.filter((row) => row.action === 'INSERT').length,
      updates: rows.filter((row) => row.action === 'UPDATE').length,
      deletes: rows.filter((row) => row.action === 'DELETE').length,
    };
  }, [logs.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit logs"
        description="Immutable trail of appointment, inventory, invoice and role changes."
      />

      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Select
            label="Table"
            value={tableFilter}
            onChange={(event) => setTableFilter(event.target.value)}
          >
            <option value="all">All tables</option>
            {TABLES.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </Select>
          <Select
            label="Action"
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
          >
            <option value="all">All actions</option>
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              setTableFilter('all');
              setActionFilter('all');
            }}
          >
            Reset
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Badge tone="slate">{summary.total} entries</Badge>
          <Badge tone="emerald">{summary.inserts} inserts</Badge>
          <Badge tone="brand">{summary.updates} updates</Badge>
          <Badge tone="rose">{summary.deletes} deletes</Badge>
        </div>
      </Card>

      <Card>
        <CardHeader title="Recent activity" description="Newest first, capped at 200 entries." />
        {logs.loading ? (
          <InlineLoader label="Loading audit trail…" />
        ) : logs.error ? (
          <div className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {logs.error || getErrorMessage(null, 'Could not load audit logs')}
            </p>
            <Button size="sm" variant="outline" onClick={logs.reload}>
              Try again
            </Button>
          </div>
        ) : !logs.data || logs.data.length === 0 ? (
          <EmptyState
            title="No audit entries"
            description="Changes to key records will be recorded here automatically."
            icon={<ShieldIcon />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3">When</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Table</th>
                  <th className="px-5 py-3">Record</th>
                  <th className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.data.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600 dark:text-slate-300">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {log.user?.full_name ?? 'System'}
                      </p>
                      <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
                        {log.user?.role ?? 'service'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={actionTone(log.action)}>{log.action}</Badge>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                      {log.table_name}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {log.record_id ? `${log.record_id.slice(0, 8)}…` : '—'}
                    </td>
                    <td className="px-5 py-4">
                      {log.details ? (
                        <details className="max-w-md">
                          <summary className="cursor-pointer text-xs font-semibold text-brand-600 dark:text-brand-400">
                            View JSON
                          </summary>
                          <pre className="mt-2 max-h-52 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
