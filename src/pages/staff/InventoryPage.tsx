import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  BoxIcon,
  DownloadIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from '../../components/icons';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  InlineLoader,
  Input,
  Modal,
  PageHeader,
  Select,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import {
  inventoryItemSchema,
  stockMovementSchema,
  type InventoryItemValues,
  type StockMovementValues,
} from '../../lib/schemas';
import { supabase } from '../../lib/supabase';
import {
  cn,
  downloadCsv,
  formatCurrency,
  formatDate,
  getErrorMessage,
  todayInClinicTimeZone,
  type CsvColumn,
} from '../../lib/utils';
import type { InventoryItem } from '../../types/database';

const DEFAULT_ITEM_VALUES: InventoryItemValues = {
  name: '',
  sku: '',
  category: '',
  quantity: 0,
  reorderLevel: 5,
  unitPrice: 0,
  expiryDate: '',
  supplier: '',
};

function daysUntil(dateString: string | null): number | null {
  if (!dateString) return null;
  const expiry = new Date(`${dateString}T23:59:59.000Z`).getTime();
  if (Number.isNaN(expiry)) return null;
  const today = new Date(`${todayInClinicTimeZone()}T00:00:00.000Z`).getTime();
  return Math.ceil((expiry - today) / 86_400_000);
}

function stockBadge(item: InventoryItem) {
  if (item.quantity === 0) return <Badge tone="rose">Out of stock</Badge>;
  if (item.quantity <= item.reorder_level) return <Badge tone="amber">Low stock</Badge>;
  return <Badge tone="emerald">In stock</Badge>;
}

function friendlyInventoryError(message: string): string {
  if (message.toLowerCase().includes('duplicate key')) {
    return 'An item with that SKU already exists. Use a unique SKU.';
  }
  if (message.toLowerCase().includes('insufficient stock')) {
    return 'Not enough stock for that movement.';
  }
  return message;
}

export function InventoryPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [savingMovement, setSavingMovement] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const items = useFetch<InventoryItem[]>(async () => {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }, []);

  const itemForm = useForm<InventoryItemValues>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: DEFAULT_ITEM_VALUES,
  });

  const movementForm = useForm<StockMovementValues>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: { direction: 'in', amount: 1, reason: '' },
  });

  const categories = useMemo(() => {
    const values = new Set<string>();
    for (const item of items.data ?? []) {
      if (item.category) values.add(item.category);
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [items.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (items.data ?? []).filter((item) => {
      const matchesTerm =
        term.length === 0 ||
        item.name.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term) ||
        (item.category ?? '').toLowerCase().includes(term) ||
        (item.supplier ?? '').toLowerCase().includes(term);
      const matchesCategory = category === 'all' || item.category === category;
      return matchesTerm && matchesCategory;
    });
  }, [items.data, search, category]);

  const openCreate = () => {
    setEditing(null);
    itemForm.reset(DEFAULT_ITEM_VALUES);
    setItemModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    itemForm.reset({
      name: item.name,
      sku: item.sku,
      category: item.category ?? '',
      quantity: item.quantity,
      reorderLevel: item.reorder_level,
      unitPrice: item.unit_price,
      expiryDate: item.expiry_date ?? '',
      supplier: item.supplier ?? '',
    });
    setItemModalOpen(true);
  };

  const submitItem = async (values: InventoryItemValues) => {
    setSavingItem(true);
    try {
      const payload = {
        name: values.name.trim(),
        sku: values.sku.trim().toUpperCase(),
        category: values.category?.trim() || null,
        quantity: values.quantity,
        reorder_level: values.reorderLevel,
        unit_price: values.unitPrice,
        expiry_date: values.expiryDate?.trim() || null,
        supplier: values.supplier?.trim() || null,
      };

      if (editing) {
        const { error } = await supabase
          .from('inventory_items')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Item updated');
      } else {
        const { error } = await supabase.from('inventory_items').insert(payload);
        if (error) throw error;
        toast.success('Item added to inventory');
      }
      setItemModalOpen(false);
      items.reload();
    } catch (error) {
      toast.error(friendlyInventoryError(getErrorMessage(error, 'Could not save the item')));
    } finally {
      setSavingItem(false);
    }
  };

  const openMovement = (item: InventoryItem) => {
    movementForm.reset({ direction: 'in', amount: 1, reason: '' });
    setMovementItem(item);
  };

  const submitMovement = async (values: StockMovementValues) => {
    if (!movementItem) return;
    setSavingMovement(true);
    try {
      const { error } = await supabase.from('inventory_movements').insert({
        item_id: movementItem.id,
        change: values.direction === 'in' ? values.amount : -values.amount,
        reason: values.reason.trim(),
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success(
        `Stock ${values.direction === 'in' ? 'added' : 'removed'} for ${movementItem.name}`,
      );
      setMovementItem(null);
      items.reload();
    } catch (error) {
      toast.error(friendlyInventoryError(getErrorMessage(error, 'Could not record the movement')));
    } finally {
      setSavingMovement(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('inventory_items').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Item deleted');
      setDeleteTarget(null);
      items.reload();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not delete the item'));
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    const columns: CsvColumn<InventoryItem>[] = [
      { label: 'Name', value: (row) => row.name },
      { label: 'SKU', value: (row) => row.sku },
      { label: 'Category', value: (row) => row.category },
      { label: 'Quantity', value: (row) => row.quantity },
      { label: 'Reorder level', value: (row) => row.reorder_level },
      { label: 'Unit price', value: (row) => row.unit_price },
      { label: 'Expiry date', value: (row) => row.expiry_date },
      { label: 'Supplier', value: (row) => row.supplier },
    ];
    try {
      downloadCsv(`clinicflow-inventory-${todayInClinicTimeZone()}.csv`, columns, filtered);
      toast.success(`Exported ${filtered.length} items`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not export inventory'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Track stock, reorder levels, expiry dates and every movement."
        actions={
          <>
            <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
              <DownloadIcon className="h-4 w-4" />
              CSV export
            </Button>
            <Button onClick={openCreate}>
              <PlusIcon className="h-4 w-4" />
              Add item
            </Button>
          </>
        }
      />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative flex-1">
            <label htmlFor="inventory-search" className="field-label">
              Search
            </label>
            <span className="pointer-events-none absolute left-3 top-[38px] text-slate-400">
              <SearchIcon className="h-4 w-4" />
            </span>
            <input
              id="inventory-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, SKU, supplier…"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div className="sm:w-56">
            <Select
              label="Category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        {items.loading ? (
          <InlineLoader label="Loading inventory…" />
        ) : items.error ? (
          <div className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <p className="text-sm text-rose-600 dark:text-rose-400">{items.error}</p>
            <Button size="sm" variant="outline" onClick={items.reload}>
              Try again
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={items.data?.length === 0 ? 'Your inventory is empty' : 'No matching items'}
            description={
              items.data?.length === 0
                ? 'Add your first item to start tracking stock levels.'
                : 'Adjust your search or category filter.'
            }
            icon={<BoxIcon />}
            action={
              items.data?.length === 0 ? (
                <Button size="sm" onClick={openCreate}>
                  Add item
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3">Item</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Stock</th>
                  <th className="px-5 py-3">Unit price</th>
                  <th className="px-5 py-3">Expiry</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((item) => {
                  const expiryDays = daysUntil(item.expiry_date);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.sku}
                          {item.supplier ? ` · ${item.supplier}` : ''}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {item.category ?? '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {item.quantity}
                            <span className="ml-1 text-xs font-normal text-slate-400">
                              / reorder {item.reorder_level}
                            </span>
                          </span>
                          {stockBadge(item)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-5 py-4">
                        {item.expiry_date ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                              {formatDate(item.expiry_date)}
                            </span>
                            {expiryDays !== null && expiryDays <= 30 ? (
                              <Badge tone={expiryDays <= 7 ? 'rose' : 'amber'}>
                                {expiryDays < 0 ? 'Expired' : `${expiryDays}d left`}
                              </Badge>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => openMovement(item)}>
                            Stock
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                            onClick={() => setDeleteTarget(item)}
                            aria-label={`Delete ${item.name}`}
                          >
                            <TrashIcon className="h-4 w-4" />
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

      {/* Add / edit item */}
      <Modal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title={editing ? 'Edit item' : 'Add inventory item'}
        description="Quantities change through stock movements; initial stock is set here."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setItemModalOpen(false)} disabled={savingItem}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="inventory-form"
              loading={savingItem}
            >
              {editing ? 'Save changes' : 'Add item'}
            </Button>
          </>
        }
      >
        <form
          id="inventory-form"
          onSubmit={itemForm.handleSubmit(submitItem)}
          className="grid gap-4 sm:grid-cols-2"
          noValidate
        >
          <Input
            label="Item name"
            error={itemForm.formState.errors.name?.message}
            {...itemForm.register('name')}
          />
          <Input
            label="SKU"
            hint="Unique stock keeping unit."
            error={itemForm.formState.errors.sku?.message}
            {...itemForm.register('sku')}
          />
          <Input
            label="Category"
            placeholder="Medicine, Supplies…"
            error={itemForm.formState.errors.category?.message}
            {...itemForm.register('category')}
          />
          <Input
            label="Supplier"
            error={itemForm.formState.errors.supplier?.message}
            {...itemForm.register('supplier')}
          />
          <Input
            label="Quantity"
            type="number"
            min={0}
            step={1}
            error={itemForm.formState.errors.quantity?.message}
            {...itemForm.register('quantity', { valueAsNumber: true })}
          />
          <Input
            label="Reorder level"
            type="number"
            min={0}
            step={1}
            hint="Alerts appear at or below this quantity."
            error={itemForm.formState.errors.reorderLevel?.message}
            {...itemForm.register('reorderLevel', { valueAsNumber: true })}
          />
          <Input
            label="Unit price"
            type="number"
            min={0}
            step="0.01"
            error={itemForm.formState.errors.unitPrice?.message}
            {...itemForm.register('unitPrice', { valueAsNumber: true })}
          />
          <Input
            label="Expiry date"
            type="date"
            error={itemForm.formState.errors.expiryDate?.message}
            {...itemForm.register('expiryDate')}
          />
        </form>
      </Modal>

      {/* Stock movement */}
      <Modal
        open={movementItem !== null}
        onClose={() => setMovementItem(null)}
        title="Record stock movement"
        description={
          movementItem
            ? `${movementItem.name} · currently ${movementItem.quantity} units`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setMovementItem(null)}
              disabled={savingMovement}
            >
              Cancel
            </Button>
            <Button type="submit" form="movement-form" loading={savingMovement}>
              Save movement
            </Button>
          </>
        }
      >
        <form
          id="movement-form"
          onSubmit={movementForm.handleSubmit(submitMovement)}
          className="space-y-4"
          noValidate
        >
          <Select
            label="Direction"
            error={movementForm.formState.errors.direction?.message}
            {...movementForm.register('direction')}
          >
            <option value="in">Stock in (delivery / return)</option>
            <option value="out">Stock out (dispensed / used)</option>
          </Select>
          <Input
            label="Quantity"
            type="number"
            min={1}
            step={1}
            error={movementForm.formState.errors.amount?.message}
            {...movementForm.register('amount', { valueAsNumber: true })}
          />
          <Input
            label="Reason"
            placeholder="Delivery, dispensed to patient, expired…"
            error={movementForm.formState.errors.reason?.message}
            {...movementForm.register('reason')}
          />
          <p className={cn('text-xs text-slate-500 dark:text-slate-400')}>
            Movements are logged and inventory quantity is updated automatically by the database.
          </p>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete inventory item?"
        description="This also removes its stock movement history. This cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void confirmDelete()}>
              Delete item
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          You are about to delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.sku}).
        </p>
      </Modal>
    </div>
  );
}
