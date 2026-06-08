import { useState } from 'react';
import { Plus, Send, X, PackagePlus, ArrowDownToLine, ArrowUpFromLine, Sliders } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { toast } from '../../../lib/toast';
import { useAuthStore } from '../../../lib/auth/authStore';
import { formatTZS, formatDate } from '../utils/money';
import {
  FinanceWorkspaceShell,
  FinanceBreadcrumb,
  FinanceMetricStrip,
} from '../components/FinanceWorkspaceShell';
import { FundRequestBoard } from '../components/FundRequestBoard';
import { EXPENSE_CATEGORY_OPTIONS, STORE_CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS } from '../components/financeOpsConstants';
import {
  useExpenses,
  useExpenseSummary,
  useCreateExpenseMutation,
  useVoidExpenseMutation,
  useStoreItems,
  useStoreSummary,
  useStoreMovements,
  useCreateStoreItemMutation,
  useReceiveStockMutation,
  useIssueStockMutation,
  useAdjustStockMutation,
  type StoreItemRow,
} from '../api/financeOps.hooks';

const input = 'mt-1 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f]';
const lbl = 'text-[11px] font-black uppercase tracking-widest text-[#64748b]';

function useUserName() {
  return useAuthStore((s) => s.session?.user?.name) ?? 'Finance Officer';
}

// ════════════════════════════════ FUND REQUESTS (bursar) ════════════════════════
export function BursarFundRequestsPage() {
  const userName = useUserName();
  return (
    <FinanceWorkspaceShell title="Fund Requests" eyebrow="Departmental funding workflow">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Fund Requests' }]} />
      <FundRequestBoard role="bursar" userName={userName} />
    </FinanceWorkspaceShell>
  );
}

// ════════════════════════════════ EXPENSES ══════════════════════════════════════
export function ExpensesPage() {
  const userName = useUserName();
  const { data: expenses = [], isLoading } = useExpenses();
  const { data: summary } = useExpenseSummary();
  const [showForm, setShowForm] = useState(false);
  const voidMutation = useVoidExpenseMutation();

  const topCategory = summary?.byCategory?.slice().sort((a, b) => b.total - a.total)[0];

  return (
    <FinanceWorkspaceShell title="Expenditure Ledger" eyebrow="Record & track school spending">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Expenses' }]} />
      <FinanceMetricStrip items={[
        { label: 'Total Spent', value: formatTZS(summary?.totalSpent ?? 0), detail: 'All recorded expenses', tone: 'red' },
        { label: 'Entries', value: String(summary?.count ?? 0), detail: 'Expense records', tone: 'navy' },
        { label: 'Top Category', value: topCategory ? topCategory.category.replaceAll('_', ' ') : '—', detail: topCategory ? formatTZS(topCategory.total) : 'No data', tone: 'gold' },
        { label: 'Categories', value: String(summary?.byCategory?.length ?? 0), detail: 'Active spend areas', tone: 'slate' },
      ]} />

      <div className="flex justify-end">
        <Button className="rounded bg-[#00334f] py-2 text-xs hover:bg-[#001e30] hover:shadow-none" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> Record Expense
        </Button>
      </div>

      {showForm && <RecordExpenseForm userName={userName} onDone={() => setShowForm(false)} />}

      {isLoading ? (
        <SkeletonTable cols={7} />
      ) : !expenses.length ? (
        <EmptyState title="No expenses recorded" description="Record your first expense to start tracking spending." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ minWidth: 1050 }}>
              <thead className="bg-[#eef5f8]">
                <tr>{['Number', 'Date', 'Category', 'Description', 'Payee', 'Amount', 'Status', ''].map((c) => (
                  <th key={c} className="border-b border-[#d5dde6] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#00334f]">{c}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {expenses.map((e) => (
                  <tr key={e.id} className="bg-white even:bg-[#f7f9fb] hover:bg-[#eef5f8]">
                    <td className="px-4 py-3 font-black text-[#00334f]">{e.expenseNumber}</td>
                    <td className="px-4 py-3 text-[#475569]">{formatDate(e.incurredAt)}</td>
                    <td className="px-4 py-3"><Badge tone="slate">{e.category.replaceAll('_', ' ')}</Badge></td>
                    <td className="px-4 py-3 text-[#0f172a]">{e.description}{e.fundRequestId && <span className="ml-1 text-[10px] font-black uppercase text-[#0284c7]">· fund</span>}</td>
                    <td className="px-4 py-3 text-[#475569]">{e.payee || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono font-black tabular-nums text-[#0f172a]">{formatTZS(e.amount)}</td>
                    <td className="px-4 py-3"><Badge tone={e.status === 'VOIDED' ? 'rose' : 'emerald'}>{e.status}</Badge></td>
                    <td className="px-4 py-3">
                      {e.status !== 'VOIDED' && !e.fundRequestId && (
                        <button
                          onClick={() => { const reason = window.prompt('Reason for voiding this expense?'); if (reason) voidMutation.mutate({ id: e.id, reason }, { onSuccess: () => toast('Expense voided', 'success'), onError: () => toast('Failed to void', 'error') }); }}
                          className="rounded border border-rose-200 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-rose-700 hover:bg-rose-50"
                        >Void</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FinanceWorkspaceShell>
  );
}

function RecordExpenseForm({ userName, onDone }: { userName: string; onDone: () => void }) {
  const createMutation = useCreateExpenseMutation();
  const [form, setForm] = useState({ category: 'SUPPLIES', description: '', amount: '', payee: '', paymentMethod: 'CASH', reference: '', department: '', incurredAt: new Date().toISOString().slice(0, 10), notes: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) { toast('Description and amount are required', 'error'); return; }
    createMutation.mutate(
      { ...form, recordedByName: userName, incurredAt: new Date(form.incurredAt).toISOString() },
      { onSuccess: () => { toast('Expense recorded', 'success'); onDone(); }, onError: () => toast('Failed to record expense', 'error') },
    );
  };
  return (
    <form onSubmit={submit} className="rounded-lg border border-[#d5dde6] bg-white p-5">
      <h3 className="font-display text-lg font-black text-[#00334f]">Record Expense</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="block"><span className={lbl}>Category</span><select value={form.category} onChange={set('category')} className={input}>{EXPENSE_CATEGORY_OPTIONS.filter((c) => c !== 'FUND_DISBURSEMENT').map((c) => <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>)}</select></label>
        <label className="block"><span className={lbl}>Amount (TZS) *</span><input type="number" value={form.amount} onChange={set('amount')} className={input} placeholder="120000" /></label>
        <label className="block"><span className={lbl}>Date *</span><input type="date" value={form.incurredAt} onChange={set('incurredAt')} className={input} /></label>
        <label className="block md:col-span-3"><span className={lbl}>Description *</span><input value={form.description} onChange={set('description')} className={input} placeholder="e.g. Diesel for school generator" /></label>
        <label className="block"><span className={lbl}>Payee</span><input value={form.payee} onChange={set('payee')} className={input} placeholder="Supplier / vendor" /></label>
        <label className="block"><span className={lbl}>Method</span><select value={form.paymentMethod} onChange={set('paymentMethod')} className={input}>{PAYMENT_METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m.replaceAll('_', ' ')}</option>)}</select></label>
        <label className="block"><span className={lbl}>Reference</span><input value={form.reference} onChange={set('reference')} className={input} placeholder="Receipt / voucher no." /></label>
        <label className="block"><span className={lbl}>Department</span><input value={form.department} onChange={set('department')} className={input} placeholder="e.g. Catering" /></label>
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" className="rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none" disabled={createMutation.isPending}><Send className="h-4 w-4" /> {createMutation.isPending ? 'Saving…' : 'Save Expense'}</Button>
        <Button type="button" variant="secondary" className="rounded" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// ════════════════════════════════ STORE / INVENTORY ═════════════════════════════
export function StorePage() {
  const userName = useUserName();
  const { data: items = [], isLoading } = useStoreItems();
  const { data: summary } = useStoreSummary();
  const { data: movements = [] } = useStoreMovements({ limit: 12 });
  const [showForm, setShowForm] = useState(false);
  const [stock, setStock] = useState<{ kind: 'receive' | 'issue' | 'adjust'; item: StoreItemRow } | null>(null);

  return (
    <FinanceWorkspaceShell title="Store & Inventory" eyebrow="Food store & supplies control">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Store' }]} />
      <FinanceMetricStrip items={[
        { label: 'Stock Value', value: formatTZS(summary?.totalStockValue ?? 0), detail: 'On-hand valuation', tone: 'navy' },
        { label: 'Items', value: String(summary?.totalItems ?? 0), detail: 'Active store items', tone: 'green' },
        { label: 'Low Stock', value: String(summary?.lowStockCount ?? 0), detail: 'At/below reorder level', tone: summary && summary.lowStockCount > 0 ? 'red' : 'slate' },
        { label: 'Categories', value: String(summary?.byCategory?.length ?? 0), detail: 'Stock groups', tone: 'gold' },
      ]} />

      <div className="flex justify-end">
        <Button className="rounded bg-[#00334f] py-2 text-xs hover:bg-[#001e30] hover:shadow-none" onClick={() => setShowForm((v) => !v)}>
          <PackagePlus className="h-3.5 w-3.5" /> New Item
        </Button>
      </div>

      {showForm && <CreateItemForm onDone={() => setShowForm(false)} />}

      {isLoading ? (
        <SkeletonTable cols={7} />
      ) : !items.length ? (
        <EmptyState title="No store items" description="Add an item (e.g. Rice 50kg bag) to start tracking stock in and out." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ minWidth: 1050 }}>
              <thead className="bg-[#eef5f8]">
                <tr>{['Code', 'Item', 'Category', 'On Hand', 'Unit Cost', 'Value', 'Actions'].map((c) => (
                  <th key={c} className="border-b border-[#d5dde6] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#00334f]">{c}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {items.map((it) => (
                  <tr key={it.id} className="bg-white even:bg-[#f7f9fb] hover:bg-[#eef5f8]">
                    <td className="px-4 py-3 font-black text-[#00334f]">{it.itemCode}</td>
                    <td className="px-4 py-3"><div className="font-bold text-[#0f172a]">{it.name}</div><div className="text-[11px] text-[#64748b]">{it.location || '—'}</div></td>
                    <td className="px-4 py-3"><Badge tone="slate">{it.category}</Badge></td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-black text-[#0f172a]">{it.quantityOnHand} {it.unit}</span>
                      {it.lowStock && <Badge tone="rose">Low</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[#475569]">{formatTZS(it.unitCost)}</td>
                    <td className="px-4 py-3 text-right font-mono font-black tabular-nums text-[#0f172a]">{formatTZS(it.stockValue)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => setStock({ kind: 'receive', item: it })} className="inline-flex items-center gap-1 rounded border border-emerald-200 px-2 py-1 text-[11px] font-black uppercase text-emerald-700 hover:bg-emerald-50"><ArrowDownToLine className="h-3 w-3" /> In</button>
                        <button onClick={() => setStock({ kind: 'issue', item: it })} className="inline-flex items-center gap-1 rounded border border-amber-200 px-2 py-1 text-[11px] font-black uppercase text-amber-700 hover:bg-amber-50"><ArrowUpFromLine className="h-3 w-3" /> Out</button>
                        <button onClick={() => setStock({ kind: 'adjust', item: it })} className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-black uppercase text-slate-600 hover:bg-slate-50"><Sliders className="h-3 w-3" /> Adj</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent movements */}
      {movements.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-xl font-black text-[#00334f]">Recent Movements</h2>
          <div className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" style={{ minWidth: 900 }}>
                <thead className="bg-[#eef5f8]"><tr>{['Ref', 'Date', 'Item', 'Type', 'Qty', 'Balance', 'To / From'].map((c) => (
                  <th key={c} className="border-b border-[#d5dde6] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#00334f]">{c}</th>
                ))}</tr></thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {movements.map((m) => (
                    <tr key={m.id} className="bg-white even:bg-[#f7f9fb]">
                      <td className="px-4 py-2.5 font-mono text-xs font-black text-[#00334f]">{m.movementNumber}</td>
                      <td className="px-4 py-2.5 text-[#475569]">{formatDate(m.occurredAt)}</td>
                      <td className="px-4 py-2.5 text-[#0f172a]">{m.itemName}</td>
                      <td className="px-4 py-2.5"><Badge tone={m.type === 'RECEIPT' ? 'emerald' : m.type === 'ISSUE' ? 'amber' : 'slate'}>{m.type}</Badge></td>
                      <td className="px-4 py-2.5 font-mono font-black text-[#0f172a]">{m.quantity} {m.unit}</td>
                      <td className="px-4 py-2.5 font-mono text-[#475569]">{m.balanceAfter} {m.unit}</td>
                      <td className="px-4 py-2.5 text-[#475569]">{m.issuedTo || m.supplier || m.department || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {stock && <StockModal kind={stock.kind} item={stock.item} userName={userName} onClose={() => setStock(null)} />}
    </FinanceWorkspaceShell>
  );
}

function CreateItemForm({ onDone }: { onDone: () => void }) {
  const createMutation = useCreateStoreItemMutation();
  const [form, setForm] = useState({ name: '', category: 'FOOD', unit: 'unit', unitCost: '', openingQuantity: '', reorderLevel: '', location: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast('Item name is required', 'error'); return; }
    createMutation.mutate(form, { onSuccess: () => { toast('Item added', 'success'); onDone(); }, onError: () => toast('Failed to add item', 'error') });
  };
  return (
    <form onSubmit={submit} className="rounded-lg border border-[#d5dde6] bg-white p-5">
      <h3 className="font-display text-lg font-black text-[#00334f]">New Store Item</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="block md:col-span-2"><span className={lbl}>Name *</span><input value={form.name} onChange={set('name')} className={input} placeholder="e.g. Rice (50kg bag)" /></label>
        <label className="block"><span className={lbl}>Category</span><select value={form.category} onChange={set('category')} className={input}>{STORE_CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label className="block"><span className={lbl}>Unit</span><input value={form.unit} onChange={set('unit')} className={input} placeholder="bag, kg, box" /></label>
        <label className="block"><span className={lbl}>Unit Cost (TZS)</span><input type="number" value={form.unitCost} onChange={set('unitCost')} className={input} placeholder="95000" /></label>
        <label className="block"><span className={lbl}>Opening Qty</span><input type="number" value={form.openingQuantity} onChange={set('openingQuantity')} className={input} placeholder="40" /></label>
        <label className="block"><span className={lbl}>Reorder Level</span><input type="number" value={form.reorderLevel} onChange={set('reorderLevel')} className={input} placeholder="10" /></label>
        <label className="block"><span className={lbl}>Location</span><input value={form.location} onChange={set('location')} className={input} placeholder="Main Store" /></label>
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" className="rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none" disabled={createMutation.isPending}><Send className="h-4 w-4" /> {createMutation.isPending ? 'Saving…' : 'Add Item'}</Button>
        <Button type="button" variant="secondary" className="rounded" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

function StockModal({ kind, item, userName, onClose }: { kind: 'receive' | 'issue' | 'adjust'; item: StoreItemRow; userName: string; onClose: () => void }) {
  const receive = useReceiveStockMutation();
  const issue = useIssueStockMutation();
  const adjust = useAdjustStockMutation();
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState(String(item.unitCost || ''));
  const [party, setParty] = useState('');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const busy = receive.isPending || issue.isPending || adjust.isPending;

  const titles = { receive: 'Receive Stock', issue: 'Issue Stock', adjust: 'Adjust Stock' };
  const run = () => {
    const ok = (m: string) => { toast(m, 'success'); onClose(); };
    const err = (e: unknown) => toast((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Action failed', 'error');
    if (kind === 'receive') {
      if (!qty) { toast('Quantity is required', 'error'); return; }
      receive.mutate({ id: item.id, body: { quantity: qty, unitCost: unitCost || undefined, supplier: party || undefined, reference: reference || undefined, actorName: userName } }, { onSuccess: () => ok('Stock received'), onError: err });
    } else if (kind === 'issue') {
      if (!qty) { toast('Quantity is required', 'error'); return; }
      issue.mutate({ id: item.id, body: { quantity: qty, issuedTo: party || undefined, reference: reference || undefined, reason: reason || undefined, actorName: userName } }, { onSuccess: () => ok('Stock issued'), onError: err });
    } else {
      if (!qty || !reason.trim()) { toast('New quantity and reason are required', 'error'); return; }
      adjust.mutate({ id: item.id, body: { newQuantity: qty, reason, actorName: userName } }, { onSuccess: () => ok('Stock adjusted'), onError: err });
    }
  };

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-[#d5dde6] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-black text-[#00334f]">{titles[kind]}</h2>
            <p className="mt-1 text-sm font-semibold text-[#64748b]">{item.name} · {item.quantityOnHand} {item.unit} on hand</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[#64748b] hover:bg-[#f1f5f9]"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block"><span className={lbl}>{kind === 'adjust' ? 'New quantity *' : 'Quantity *'}</span><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className={input} placeholder={`In ${item.unit}`} /></label>
          {kind === 'receive' && <label className="block"><span className={lbl}>Unit cost (TZS)</span><input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={input} /></label>}
          {kind === 'receive' && <label className="block"><span className={lbl}>Supplier</span><input value={party} onChange={(e) => setParty(e.target.value)} className={input} placeholder="Supplier name" /></label>}
          {kind === 'issue' && <label className="block"><span className={lbl}>Issued to</span><input value={party} onChange={(e) => setParty(e.target.value)} className={input} placeholder="e.g. Kitchen" /></label>}
          {kind !== 'adjust' && <label className="block"><span className={lbl}>Reference</span><input value={reference} onChange={(e) => setReference(e.target.value)} className={input} placeholder="GRN / voucher" /></label>}
          <label className="block"><span className={lbl}>{kind === 'adjust' ? 'Reason *' : 'Reason / note'}</span><input value={reason} onChange={(e) => setReason(e.target.value)} className={input} placeholder={kind === 'issue' ? 'e.g. Weekly meals' : 'Optional'} /></label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" className="rounded" onClick={onClose}>Cancel</Button>
          <Button className="rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none" onClick={run} disabled={busy}>{busy ? 'Working…' : titles[kind]}</Button>
        </div>
      </div>
    </div>
  );
}
