import { useState } from 'react';
import { AlertTriangle, ArrowRight, Plus, Send, X, PackagePlus, ArrowDownToLine, ArrowUpFromLine, Sliders, FileText, AlertCircle, BarChart3, ClipboardList } from 'lucide-react';
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
import { FinancialStatementReport } from '../components/FinancialStatementReport';
import { EXPENSE_CATEGORY_OPTIONS, STORE_CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS, STORE_UNIT_OPTIONS } from '../components/financeOpsConstants';
import { getLogoBase64 } from '../components/FinanceWorkspaceShell';
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

// ════════════════════════════════ FINANCIAL STATEMENT ═══════════════════════════
export function FinancialStatementPage() {
  return (
    <FinanceWorkspaceShell title="Financial Statement" eyebrow="Period reports · PDF & Excel">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Reports', to: '/finance/reports' }, { label: 'Financial Statement' }]} />
      <FinancialStatementReport />
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

// ─── Low stock alert panel ────────────────────────────────────────────────────
function LowStockAlerts({ items, onReceive }: { items: StoreItemRow[]; onReceive: (item: StoreItemRow) => void }) {
  const critical = items.filter((i) => i.quantityOnHand === 0);
  const warning  = items.filter((i) => i.quantityOnHand > 0);
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <p className="font-black text-red-700">
            {critical.length > 0 && `${critical.length} item${critical.length !== 1 ? 's' : ''} out of stock · `}
            {warning.length > 0 && `${warning.length} item${warning.length !== 1 ? 's' : ''} running low`}
          </p>
          <p className="text-[11px] font-semibold text-red-500">Reorder or receive stock to avoid disruption</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const pct = item.reorderLevel > 0 ? Math.min(100, Math.round((item.quantityOnHand / item.reorderLevel) * 100)) : 0;
          const isOut = item.quantityOnHand === 0;
          return (
            <div key={item.id} className={`overflow-hidden rounded-xl border bg-white ${isOut ? 'border-red-300' : 'border-orange-200'}`}>
              <div className="px-4 pt-3.5 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#0f172a]">{item.name}</p>
                    <p className="text-[10px] text-[#64748b]">{item.itemCode} · {item.location || item.category}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${isOut ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    {isOut ? 'OUT OF STOCK' : 'LOW'}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-[#64748b]">
                    <span className={isOut ? 'font-black text-red-600' : ''}>{item.quantityOnHand} {item.unit} on hand</span>
                    <span>reorder at {item.reorderLevel} {item.unit}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                    <div className={`h-full rounded-full transition-all ${isOut ? 'bg-red-500' : 'bg-orange-400'}`}
                      style={{ width: `${Math.max(pct, isOut ? 0 : 4)}%` }} />
                  </div>
                </div>
                {item.unitCost > 0 && (
                  <p className="mt-1.5 text-[10px] text-[#94a3b8]">Unit cost: {formatTZS(item.unitCost)}</p>
                )}
              </div>
              <button onClick={() => onReceive(item)}
                className="flex w-full items-center justify-center gap-1.5 border-t border-[#f1f5f9] py-2 text-[10px] font-black uppercase tracking-wide text-emerald-700 hover:bg-emerald-50">
                <ArrowDownToLine className="h-3 w-3" /> Receive Stock
              </button>
            </div>
          );
        })}
      </div>
    </div>
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

      {/* ── Low stock alerts ── */}
      {items.filter((i) => i.lowStock).length > 0 && (
        <LowStockAlerts
          items={items.filter((i) => i.lowStock)}
          onReceive={(item) => setStock({ kind: 'receive', item })}
        />
      )}

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

      {/* ── Reports ── */}
      <StoreReportsPanel items={items} summary={summary} />

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
        <label className="block"><span className={lbl}>Unit</span><select value={form.unit} onChange={set('unit')} className={input}>{STORE_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</select></label>
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

// ════════════════════════════════ STORE REPORTS ═════════════════════════════════

type MovementRow = {
  id: string; movementNumber: string; type: string; quantity: number; totalValue: number;
  balanceAfter: number; itemName: string; unit: string; issuedTo: string; supplier: string;
  department: string; occurredAt: string; recordedByName: string;
};
type StoreSummaryData = {
  totalItems: number; lowStockCount: number; totalStockValue: number;
  byCategory: Array<{ category: string; count: number; value: number }>;
} | undefined;

const RPT_NAVY: [number,number,number]  = [0,   51,  79];
const RPT_GOLD: [number,number,number]  = [213, 154,  27];
const RPT_WHITE: [number,number,number] = [255, 255, 255];
const RPT_SLATE: [number,number,number] = [100, 116, 139];
const RPT_DARK: [number,number,number]  = [15,   23,  42];
const RPT_GREEN: [number,number,number] = [16,  185, 129];
const RPT_ROSE: [number,number,number]  = [239,  68,  68];

function rptFmt(n: number) { return 'TZS ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function rptDate(d: string) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }

type JsPDFDoc = InstanceType<{ new(...a: unknown[]): {
  setFillColor: (...args: unknown[]) => void;
  rect: (...args: unknown[]) => void;
  addImage: (...args: unknown[]) => void;
  setDrawColor: (...args: unknown[]) => void;
  setLineWidth: (w: number) => void;
  circle: (...args: unknown[]) => void;
  setFont: (f: string, s: string) => void;
  setFontSize: (s: number) => void;
  setTextColor: (...args: unknown[]) => void;
  text: (...args: unknown[]) => void;
  roundedRect: (...args: unknown[]) => void;
  addPage: () => void;
  getNumberOfPages: () => number;
  setPage: (n: number) => void;
  save: (name: string) => void;
} }>;

async function rptHeader(doc: JsPDFDoc, logo: string | null, title: string, subtitle: string, PW: number, M: number): Promise<number> {
  doc.setFillColor(...RPT_NAVY); doc.rect(0, 0, PW, 44, 'F');
  if (logo) {
    doc.addImage(logo, 'PNG', M, 7, 26, 26, undefined, 'FAST');
  } else {
    doc.setDrawColor(...RPT_GOLD); doc.setLineWidth(0.6);
    doc.circle(M + 8, 21, 8, 'D');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...RPT_GOLD);
    doc.text('KS', M + 8, 19.5, { align: 'center' });
    doc.setFontSize(5); doc.setTextColor(...RPT_WHITE); doc.text('SCHOOLS', M + 8, 25, { align: 'center' });
  }
  const tx = M + 30;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...RPT_WHITE); doc.text('Kilimanjaro Schools', tx, 15);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...RPT_GOLD); doc.text('Excellence in Education Since 2003', tx, 20);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(200, 220, 230);
  doc.text('P.O. Box 4502, Moshi, Kilimanjaro, Tanzania  ·  Tel: +255 754 000 000', tx, 25);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(160, 200, 220);
  doc.text('STORE & INVENTORY', PW - M, 13, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...RPT_WHITE); doc.text(title, PW - M, 22, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...RPT_GOLD);
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, PW - M, 28, { align: 'right' });
  doc.setFillColor(...RPT_GOLD); doc.rect(0, 44, PW, 1.5, 'F');
  doc.setFillColor(248, 250, 252); doc.rect(0, 45.5, PW, 11, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...RPT_NAVY); doc.text(subtitle, M, 53);
  return 63;
}

function rptFooter(doc: JsPDFDoc, PW: number, PH: number, pageNum: number, totalPages: number) {
  doc.setFillColor(...RPT_NAVY); doc.rect(0, PH - 10, PW, 10, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(160, 200, 220);
  doc.text('Kilimanjaro Schools — Store & Inventory Control — Confidential', 14, PH - 4);
  doc.text(`Page ${pageNum} of ${totalPages}`, PW - 14, PH - 4, { align: 'right' });
}

async function generateStockValuationPdf(items: StoreItemRow[], summary: StoreSummaryData) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), getLogoBase64()]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as unknown as JsPDFDoc;
  const PW = 210; const M = 14; const CW = PW - M * 2; const PH = 297;
  let y = await rptHeader(doc, logo, 'STOCK VALUATION', `Total stock value: ${rptFmt(summary?.totalStockValue ?? 0)}  ·  Items: ${items.length}  ·  As at ${new Date().toLocaleDateString('en-GB')}`, PW, M);
  const cats = [...new Set(items.map((i) => i.category))].sort();
  for (const cat of cats) {
    const ci = items.filter((i) => i.category === cat);
    const cv = ci.reduce((s, i) => s + i.stockValue, 0);
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFillColor(...RPT_NAVY); doc.rect(M, y, CW, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...RPT_WHITE);
    doc.text(cat, M + 3, y + 4.8); doc.text(rptFmt(cv), PW - M - 3, y + 4.8, { align: 'right' }); y += 7;
    doc.setFillColor(230, 240, 248); doc.rect(M, y, CW, 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...RPT_NAVY);
    doc.text('CODE', M + 3, y + 4.2); doc.text('ITEM', M + 32, y + 4.2); doc.text('LOCATION', M + 87, y + 4.2);
    doc.text('ON HAND', M + 136, y + 4.2, { align: 'right' }); doc.text('UNIT COST', M + 159, y + 4.2, { align: 'right' }); doc.text('VALUE', PW - M - 3, y + 4.2, { align: 'right' }); y += 6;
    ci.forEach((it, idx) => {
      if (y > 265) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(M, y, CW, 7, 'F'); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(...RPT_NAVY); doc.text(it.itemCode, M + 3, y + 4.8);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...RPT_DARK); doc.text(it.name.substring(0, 38), M + 32, y + 4.8);
      doc.text(it.location || '—', M + 87, y + 4.8);
      doc.setFont('helvetica', 'bold');
      if (it.lowStock) doc.setTextColor(...RPT_ROSE); else doc.setTextColor(...RPT_DARK);
      doc.text(`${it.quantityOnHand} ${it.unit}`, M + 136, y + 4.8, { align: 'right' });
      doc.setTextColor(...RPT_SLATE); doc.setFont('helvetica', 'normal'); doc.text(rptFmt(it.unitCost), M + 159, y + 4.8, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...RPT_NAVY); doc.text(rptFmt(it.stockValue), PW - M - 3, y + 4.8, { align: 'right' }); y += 7;
    });
    y += 3;
  }
  if (y > 265) { doc.addPage(); y = 20; }
  doc.setFillColor(...RPT_GOLD); doc.rect(M, y, CW, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...RPT_NAVY);
  doc.text('TOTAL STOCK VALUE', M + 3, y + 5.5); doc.text(rptFmt(summary?.totalStockValue ?? 0), PW - M - 3, y + 5.5, { align: 'right' });
  const tp = doc.getNumberOfPages(); for (let p = 1; p <= tp; p++) { doc.setPage(p); rptFooter(doc, PW, PH, p, tp); }
  doc.save(`Stock-Valuation-${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function generateMovementLogPdf(movements: MovementRow[]) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), getLogoBase64()]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as unknown as JsPDFDoc;
  const PW = 297; const PH = 210; const M = 14; const CW = PW - M * 2;
  const receipts = movements.filter((m) => m.type === 'RECEIPT');
  const issues   = movements.filter((m) => m.type === 'ISSUE');
  const adjusts  = movements.filter((m) => m.type === 'ADJUSTMENT');
  const totalIn  = receipts.reduce((s, m) => s + m.totalValue, 0);
  const totalOut = issues.reduce((s, m) => s + m.totalValue, 0);
  let y = await rptHeader(doc, logo, 'MOVEMENT LOG',
    `Movements: ${movements.length}  ·  Receipts: ${receipts.length}  ·  Issues: ${issues.length}  ·  Adjustments: ${adjusts.length}`,
    PW, M,
  );
  // Summary strip
  const sw = CW / 3;
  [
    { l: 'Total Receipts In', v: rptFmt(totalIn),          c: RPT_GREEN },
    { l: 'Total Issues Out',  v: rptFmt(totalOut),         c: RPT_ROSE  },
    { l: 'Net Movement',      v: rptFmt(totalIn - totalOut), c: RPT_NAVY },
  ].forEach((s, i) => {
    const sx = M + i * sw;
    doc.setFillColor(248, 250, 252); doc.rect(sx, y, sw - 4, 14, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...RPT_SLATE); doc.text(s.l, sx + 3, y + 5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...s.c); doc.text(s.v, sx + 3, y + 12);
  });
  y += 19;
  doc.setFillColor(230, 240, 248); doc.rect(M, y, CW, 6.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...RPT_NAVY);
  doc.text('REF', M + 3, y + 4.5); doc.text('DATE', M + 36, y + 4.5); doc.text('ITEM', M + 57, y + 4.5);
  doc.text('TYPE', M + 115, y + 4.5); doc.text('QTY', M + 141, y + 4.5, { align: 'right' });
  doc.text('VALUE', M + 168, y + 4.5, { align: 'right' }); doc.text('BALANCE', M + 196, y + 4.5, { align: 'right' });
  doc.text('TO / FROM / BY', M + 203, y + 4.5); y += 6.5;
  movements.forEach((m, idx) => {
    if (y > PH - 18) { doc.addPage(); y = 20; }
    if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(M, y, CW, 6.5, 'F'); }
    const tc: [number,number,number] = m.type === 'RECEIPT' ? RPT_GREEN : m.type === 'ISSUE' ? [245, 158, 11] : RPT_SLATE;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.2); doc.setTextColor(...RPT_NAVY); doc.text(m.movementNumber || '—', M + 3, y + 4.2);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...RPT_SLATE); doc.text(rptDate(m.occurredAt), M + 36, y + 4.2);
    doc.setTextColor(...RPT_DARK); doc.text((m.itemName || '—').substring(0, 38), M + 57, y + 4.2);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...tc); doc.text(m.type, M + 115, y + 4.2);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...RPT_DARK); doc.text(`${m.quantity} ${m.unit}`, M + 141, y + 4.2, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...RPT_SLATE);
    doc.text(m.totalValue ? rptFmt(m.totalValue) : '—', M + 168, y + 4.2, { align: 'right' });
    doc.text(`${m.balanceAfter} ${m.unit}`, M + 196, y + 4.2, { align: 'right' });
    doc.setTextColor(...RPT_DARK); doc.text((m.issuedTo || m.supplier || m.department || m.recordedByName || '—').substring(0, 28), M + 203, y + 4.2);
    y += 6.5;
  });
  const tp = doc.getNumberOfPages(); for (let p = 1; p <= tp; p++) { doc.setPage(p); rptFooter(doc, PW, PH, p, tp); }
  doc.save(`Stock-Movement-Log-${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function generateLowStockAlertPdf(items: StoreItemRow[]) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), getLogoBase64()]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as unknown as JsPDFDoc;
  const PW = 210; const M = 14; const CW = PW - M * 2; const PH = 297;
  const critical = items.filter((i) => i.quantityOnHand === 0);
  const warning  = items.filter((i) => i.quantityOnHand > 0 && i.lowStock);
  let y = await rptHeader(doc, logo, 'LOW STOCK ALERT',
    `Critical (out of stock): ${critical.length}  ·  Warning (below reorder): ${warning.length}  ·  ${new Date().toLocaleDateString('en-GB')}`, PW, M,
  );
  if (critical.length === 0 && warning.length === 0) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...RPT_GREEN);
    doc.text('All items are well-stocked. No alerts at this time.', PW / 2, y + 20, { align: 'center' });
  } else {
    if (critical.length > 0) {
      doc.setFillColor(254, 226, 226); doc.rect(M, y, CW, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...RPT_ROSE);
      doc.text(`OUT OF STOCK — ${critical.length} item(s) need immediate replenishment`, M + 3, y + 4.8); y += 7;
      doc.setFillColor(230, 240, 248); doc.rect(M, y, CW, 6, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...RPT_NAVY);
      doc.text('CODE', M + 3, y + 4); doc.text('ITEM', M + 32, y + 4); doc.text('CATEGORY', M + 105, y + 4); doc.text('REORDER LEVEL', PW - M - 3, y + 4, { align: 'right' }); y += 6;
      critical.forEach((it, idx) => {
        if (y > 265) { doc.addPage(); y = 20; }
        if (idx % 2 === 0) { doc.setFillColor(255, 241, 242); doc.rect(M, y, CW, 7, 'F'); }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(...RPT_ROSE); doc.text(it.itemCode, M + 3, y + 4.8);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...RPT_DARK); doc.text(it.name.substring(0, 46), M + 32, y + 4.8);
        doc.setTextColor(...RPT_SLATE); doc.text(it.category, M + 105, y + 4.8);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...RPT_ROSE); doc.text(`${it.reorderLevel} ${it.unit}`, PW - M - 3, y + 4.8, { align: 'right' }); y += 7;
      }); y += 5;
    }
    if (warning.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFillColor(255, 243, 205); doc.rect(M, y, CW, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(146, 64, 14);
      doc.text(`LOW STOCK WARNING — ${warning.length} item(s) at or below reorder level`, M + 3, y + 4.8); y += 7;
      doc.setFillColor(230, 240, 248); doc.rect(M, y, CW, 6, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...RPT_NAVY);
      doc.text('CODE', M + 3, y + 4); doc.text('ITEM', M + 32, y + 4);
      doc.text('ON HAND', M + 100, y + 4, { align: 'right' }); doc.text('REORDER AT', M + 130, y + 4, { align: 'right' }); doc.text('UNIT COST', PW - M - 3, y + 4, { align: 'right' }); y += 6;
      warning.forEach((it, idx) => {
        if (y > 265) { doc.addPage(); y = 20; }
        if (idx % 2 === 0) { doc.setFillColor(255, 251, 235); doc.rect(M, y, CW, 7, 'F'); }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(146, 64, 14); doc.text(it.itemCode, M + 3, y + 4.8);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...RPT_DARK); doc.text(it.name.substring(0, 42), M + 32, y + 4.8);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(146, 64, 14); doc.text(`${it.quantityOnHand} ${it.unit}`, M + 100, y + 4.8, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...RPT_SLATE); doc.text(`${it.reorderLevel} ${it.unit}`, M + 130, y + 4.8, { align: 'right' }); doc.text(rptFmt(it.unitCost), PW - M - 3, y + 4.8, { align: 'right' }); y += 7;
      });
    }
  }
  y += 12;
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...RPT_SLATE);
  doc.text('Prepared by: ________________________     Date: _______________', M, y); y += 8;
  doc.text('Store Manager: ________________________     Signature: _______________', M, y);
  const tp = doc.getNumberOfPages(); for (let p = 1; p <= tp; p++) { doc.setPage(p); rptFooter(doc, PW, PH, p, tp); }
  doc.save(`Low-Stock-Alert-${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function generateCategorySummaryPdf(items: StoreItemRow[], summary: StoreSummaryData) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), getLogoBase64()]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as unknown as JsPDFDoc;
  const PW = 210; const M = 14; const CW = PW - M * 2; const PH = 297;
  let y = await rptHeader(doc, logo, 'CATEGORY SUMMARY',
    `${items.length} items across ${summary?.byCategory?.length ?? 0} categories  ·  Total: ${rptFmt(summary?.totalStockValue ?? 0)}`, PW, M,
  );
  const cats = [...new Set(items.map((i) => i.category))].sort();
  const grandTotal = items.reduce((s, i) => s + i.stockValue, 0);
  const cardW = (CW - 4) / 2;
  let cardRow = 0;
  cats.forEach((cat, idx) => {
    const ci = items.filter((i) => i.category === cat);
    const cv = ci.reduce((s, i) => s + i.stockValue, 0);
    const lc = ci.filter((i) => i.lowStock).length;
    const col = idx % 2;
    if (col === 0 && idx > 0) { y += 28; cardRow++; }
    if (y > 255) { doc.addPage(); y = 20; }
    const cx = M + col * (cardW + 4);
    doc.setFillColor(248, 250, 252); doc.roundedRect(cx, y, cardW, 24, 2, 2, 'F');
    doc.setDrawColor(213, 221, 230); doc.setLineWidth(0.3); doc.roundedRect(cx, y, cardW, 24, 2, 2, 'S');
    doc.setFillColor(...RPT_NAVY); doc.roundedRect(cx, y, cardW, 7, 2, 2, 'F'); doc.rect(cx, y + 4, cardW, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...RPT_WHITE); doc.text(cat, cx + 4, y + 5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...RPT_NAVY); doc.text(rptFmt(cv), cx + 4, y + 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...RPT_SLATE); doc.text(`${ci.length} item(s)`, cx + 4, y + 20);
    if (lc > 0) { doc.setTextColor(...RPT_ROSE); doc.setFont('helvetica', 'bold'); doc.text(`⚠ ${lc} low`, cx + cardW - 4, y + 20, { align: 'right' }); }
    const pct = grandTotal > 0 ? cv / grandTotal : 0;
    doc.setFillColor(213, 221, 230); doc.rect(cx + 4, y + 21.5, cardW - 8, 1.5, 'F');
    doc.setFillColor(...RPT_GOLD); doc.rect(cx + 4, y + 21.5, (cardW - 8) * pct, 1.5, 'F');
    void cardRow;
  });
  y += 30;
  for (const cat of cats) {
    const ci = items.filter((i) => i.category === cat);
    if (y > 245) { doc.addPage(); y = 20; }
    doc.setFillColor(...RPT_NAVY); doc.rect(M, y, CW, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...RPT_WHITE);
    doc.text(cat, M + 3, y + 4.8); doc.text(`${ci.length} items · ${rptFmt(ci.reduce((s, i) => s + i.stockValue, 0))}`, PW - M - 3, y + 4.8, { align: 'right' }); y += 7;
    doc.setFillColor(230, 240, 248); doc.rect(M, y, CW, 5.5, 'F');
    doc.setFontSize(6); doc.setTextColor(...RPT_NAVY);
    doc.text('ITEM', M + 3, y + 3.8); doc.text('ON HAND', M + 100, y + 3.8, { align: 'right' }); doc.text('UNIT COST', M + 130, y + 3.8, { align: 'right' }); doc.text('VALUE', PW - M - 3, y + 3.8, { align: 'right' }); y += 5.5;
    ci.forEach((it, idx) => {
      if (y > 265) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(M, y, CW, 6.5, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...RPT_DARK); doc.text(it.name.substring(0, 46), M + 3, y + 4.2);
      doc.setFont('helvetica', 'bold');
      if (it.lowStock) doc.setTextColor(...RPT_ROSE); else doc.setTextColor(...RPT_DARK);
      doc.text(`${it.quantityOnHand} ${it.unit}`, M + 100, y + 4.2, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...RPT_SLATE); doc.text(rptFmt(it.unitCost), M + 130, y + 4.2, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...RPT_NAVY); doc.text(rptFmt(it.stockValue), PW - M - 3, y + 4.2, { align: 'right' }); y += 6.5;
    }); y += 4;
  }
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFillColor(...RPT_GOLD); doc.rect(M, y, CW, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...RPT_NAVY);
  doc.text('GRAND TOTAL', M + 3, y + 5.5); doc.text(rptFmt(grandTotal), PW - M - 3, y + 5.5, { align: 'right' });
  const tp = doc.getNumberOfPages(); for (let p = 1; p <= tp; p++) { doc.setPage(p); rptFooter(doc, PW, PH, p, tp); }
  doc.save(`Store-Category-Summary-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function StoreReportsPanel({ items, summary }: { items: StoreItemRow[]; summary: StoreSummaryData }) {
  const { data: allMovements = [], isFetching: fetchingMov } = useStoreMovements({ limit: 9999 });
  const [loading, setLoading] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>) => {
    setLoading(key);
    try { await fn(); } catch (e) { toast('Failed to generate report', 'error'); console.error(e); }
    finally { setLoading(null); }
  };
  const reports = [
    {
      key: 'valuation', icon: <BarChart3 className="h-5 w-5" />,
      title: 'Stock Valuation Report',
      desc: `Full on-hand inventory with unit costs & total values, grouped by category. ${items.length} item(s) · ${rptFmt(summary?.totalStockValue ?? 0)}`,
      action: () => generateStockValuationPdf(items, summary),
    },
    {
      key: 'movements', icon: <ClipboardList className="h-5 w-5" />,
      title: 'Movement Log Report',
      desc: `Chronological log of all stock receipts, issues and adjustments. ${allMovements.length} movement(s) on record.`,
      action: () => generateMovementLogPdf(allMovements as MovementRow[]),
      disabled: fetchingMov,
    },
    {
      key: 'lowstock', icon: <AlertCircle className="h-5 w-5" />,
      title: 'Low Stock Alert Report',
      desc: `Items at or below reorder level requiring replenishment. ${items.filter((i) => i.lowStock).length} alert(s) active.`,
      action: () => generateLowStockAlertPdf(items),
    },
    {
      key: 'category', icon: <FileText className="h-5 w-5" />,
      title: 'Category Summary Report',
      desc: `Stock breakdown by category with value share analysis and item detail per group.`,
      action: () => generateCategorySummaryPdf(items, summary),
    },
  ] as const;
  return (
    <div>
      <h2 className="mb-3 font-display text-xl font-black text-[#00334f]">Reports</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {reports.map((r) => (
          <div key={r.key} className="flex items-start gap-4 rounded-lg border border-[#d5dde6] bg-white p-4">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef5f8] text-[#00334f]">
              {r.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm text-[#0f172a]">{r.title}</p>
              <p className="mt-0.5 text-[11px] text-[#64748b]">{r.desc}</p>
            </div>
            <button
              onClick={() => run(r.key, r.action)}
              disabled={loading === r.key || ('disabled' in r && r.disabled)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded bg-[#00334f] px-3 py-2 text-xs font-black text-white hover:bg-[#001e30] disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              {loading === r.key ? 'Generating…' : 'PDF'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
