import { CalendarClock, Eye, FileText, Image as ImageIcon, Landmark, Pencil, Plus, Power, Send, Smartphone, Trash2, Upload, Wallet } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { errorMessage } from '../../../lib/api/errors';
import { useAuthStore } from '../../../lib/auth/authStore';
import { useSchoolStore } from '../../../lib/school/schoolStore';
import { toast } from '../../../lib/toast';
import { FinanceBreadcrumb, FinanceWorkspaceShell } from '../components/FinanceWorkspaceShell';
import { useFeeCategories } from '../api/finance.hooks';
import { useFinanceAcademicYears, useFinanceTerms } from '../api/financeOps.hooks';
import {
  openSampleInvoice,
  useApplyInvoicePlan,
  useApplyPlansToTerm,
  useClearInvoicePlan,
  useCreatePaymentAccount,
  useCreatePaymentPlan,
  useFinanceSettings,
  useInvoicePlan,
  useNotifyParentOfInvoice,
  usePaymentAccounts,
  usePaymentPlans,
  usePreviewPlan,
  useRemoveBrandingImage,
  useRemovePaymentAccount,
  useSetCustomInvoicePlan,
  useSetPlanActive,
  useUpdateFinanceSettings,
  useUpdatePaymentAccount,
  useUpdatePaymentPlan,
  useUploadBrandingImage,
  type BrandingKind,
  type PaymentAccount,
  type PaymentPlan,
  type PlanInstallmentInput,
} from '../api/financeConfig.hooks';

const input = 'mt-1 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 text-sm font-semibold outline-none focus:border-[#00334f]';
const cap = 'text-[11px] font-black uppercase tracking-widest text-[#64748b]';
const money = (value: number) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const dateText = (value?: string | null) => (value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const toDateInput = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : '');

/** These pages belong to one school; someone who sees every school must pick one first. */
function NeedSchool({ children }: { children: React.ReactNode }) {
  const scope = useAuthStore((s) => s.session?.user?.scope);
  const school = useSchoolStore((s) => s.activeSchool);
  if (scope === 'GROUP' && !school) {
    return <EmptyState title="Choose a school first" description="Payment info, invoice look and payment plans are set for one school at a time. Pick the school from the switcher at the top." />;
  }
  return <>{children}</>;
}

const typeLabel = { BANK: 'Bank account', MOBILE_MONEY: 'Mobile money', OTHER: 'Other' } as const;

// ─── Payment info ────────────────────────────────────────────────────────────────────

type AccountForm = { type: PaymentAccount['type']; bankName: string; accountName: string; accountNumber: string; description: string };
const emptyAccount: AccountForm = { type: 'BANK', bankName: '', accountName: '', accountNumber: '', description: 'Fees' };

export function PaymentInfoPage() {
  const { data: accounts = [], isLoading, isError, refetch } = usePaymentAccounts(true);
  const create = useCreatePaymentAccount();
  const update = useUpdatePaymentAccount();
  const remove = useRemovePaymentAccount();
  const [editing, setEditing] = useState<{ id?: string; form: AccountForm } | null>(null);
  const active = accounts.filter((a) => a.isActive);
  const inactive = accounts.filter((a) => !a.isActive);

  const save = () => {
    if (!editing) return;
    const f = editing.form;
    if (!f.bankName.trim() || !f.accountName.trim() || !f.accountNumber.trim()) { toast('Bank name, account name and account number are required', 'error'); return; }
    const body = { type: f.type, bankName: f.bankName.trim(), accountName: f.accountName.trim(), accountNumber: f.accountNumber.trim(), description: f.description.trim() };
    const done = { onSuccess: () => { toast('Payment info saved', 'success'); setEditing(null); }, onError: (e: unknown) => toast(errorMessage(e, 'Could not save'), 'error') };
    if (editing.id) update.mutate({ id: editing.id, ...body }, done);
    else create.mutate(body, done);
  };

  return (
    <FinanceWorkspaceShell title="Payment Info" eyebrow="Where parents pay">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Fee Setup' }, { label: 'Payment Info' }]} />
      <NeedSchool>
        <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-lg border border-[#d5dde6] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d5dde6] pb-4">
              <div>
                <h2 className="font-display text-xl font-black text-[#00334f]">Payment accounts</h2>
                <p className="text-sm font-semibold text-[#64748b]">Every active account is printed on this school&apos;s invoices, in this order.</p>
              </div>
              <Button className="rounded bg-[#00334f]" onClick={() => setEditing({ form: { ...emptyAccount } })}><Plus className="h-4 w-4" /> Add account</Button>
            </div>

            {isLoading ? <div className="mt-4"><SkeletonTable cols={3} /></div> : isError ? <DataError message="Could not load payment accounts." onRetry={refetch} /> : active.length === 0 ? (
              <div className="mt-4"><EmptyState title="No payment accounts yet" description="Add the bank account or mobile-money number parents should pay into. Invoices show it under Payment Info." /></div>
            ) : (
              <ul className="mt-4 space-y-3">
                {active.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-[#d5dde6] p-4">
                    <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#00334f]/10 text-[#00334f]">{a.type === 'MOBILE_MONEY' ? <Smartphone className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-[#00334f]">{a.bankName} <span className="ml-1 text-xs font-bold text-[#64748b]">{typeLabel[a.type]}</span></p>
                      <p className="text-sm font-semibold text-slate-700">{a.accountName}</p>
                      <p className="font-mono text-sm font-bold text-slate-900">{a.accountNumber}{a.description ? <span className="ml-2 font-sans text-xs font-semibold text-slate-500">{a.description}</span> : null}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setEditing({ id: a.id, form: { type: a.type, bankName: a.bankName, accountName: a.accountName, accountNumber: a.accountNumber, description: a.description ?? '' } })}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                      <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => remove.mutate(a.id, { onSuccess: () => toast('Account switched off. It no longer prints on invoices.', 'success'), onError: (e) => toast(errorMessage(e, 'Could not switch off'), 'error') })}><Power className="h-3.5 w-3.5" /> Switch off</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {inactive.length > 0 && (
              <details className="mt-5">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-[#64748b]">Switched off ({inactive.length})</summary>
                <ul className="mt-3 space-y-2">
                  {inactive.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded border border-dashed border-[#d5dde6] px-4 py-2 text-sm">
                      <span className="font-semibold text-slate-500">{a.bankName} · {a.accountName} · {a.accountNumber}</span>
                      <button className="text-xs font-black uppercase text-[#0284c7] hover:underline" onClick={() => update.mutate({ id: a.id, isActive: true }, { onSuccess: () => toast('Account is active again', 'success') })}>Switch on</button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <aside className="space-y-gutter">
            <section className="rounded-lg border border-[#d5dde6] bg-white p-5">
              <h3 className="font-display text-base font-black text-[#00334f]">See it on an invoice</h3>
              <p className="mt-1 text-sm font-semibold text-[#64748b]">Opens a sample invoice with the payment info and look you have set.</p>
              <Button variant="secondary" className="mt-3 rounded" onClick={() => openSampleInvoice().catch((e) => toast(errorMessage(e, 'Could not open the sample'), 'error'))}><Eye className="h-4 w-4" /> Preview invoice</Button>
            </section>
            <section className="rounded-lg border border-[#d5dde6] bg-[#f7f9fb] p-5 text-sm font-semibold text-[#475569]">
              <p className="font-black text-[#00334f]">Who can change this</p>
              <p className="mt-1">Finance, the Head of Finance, the Principal, the Manager and administrators. Every change is recorded in the audit log with who made it.</p>
            </section>
          </aside>
        </div>

        {editing && (
          <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Payment account">
            <div className="w-full max-w-lg rounded-xl border border-[#d5dde6] bg-white p-6 shadow-2xl">
              <h2 className="font-display text-xl font-black text-[#00334f]">{editing.id ? 'Edit payment account' : 'Add payment account'}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className={cap}>Type</span>
                  <select value={editing.form.type} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, type: e.target.value as AccountForm['type'] } })} className={input}>
                    <option value="BANK">Bank account</option><option value="MOBILE_MONEY">Mobile money</option><option value="OTHER">Other</option>
                  </select>
                </label>
                <label><span className={cap}>{editing.form.type === 'MOBILE_MONEY' ? 'Network' : 'Bank'} *</span><input value={editing.form.bankName} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, bankName: e.target.value } })} placeholder={editing.form.type === 'MOBILE_MONEY' ? 'M-Pesa' : 'CRDB Bank PLC'} className={input} /></label>
                <label><span className={cap}>{editing.form.type === 'MOBILE_MONEY' ? 'Number' : 'Account number'} *</span><input value={editing.form.accountNumber} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, accountNumber: e.target.value } })} className={input} /></label>
                <label className="sm:col-span-2"><span className={cap}>Account name *</span><input value={editing.form.accountName} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, accountName: e.target.value } })} placeholder="The name the account is registered in" className={input} /></label>
                <label className="sm:col-span-2"><span className={cap}>Description (printed on the invoice)</span><input value={editing.form.description} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, description: e.target.value } })} placeholder="Fees" className={input} /></label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                <Button className="bg-[#00334f]" loading={create.isPending || update.isPending} onClick={save}>Save</Button>
              </div>
            </div>
          </div>
        )}
      </NeedSchool>
    </FinanceWorkspaceShell>
  );
}

// ─── Invoice branding ────────────────────────────────────────────────────────────────

/** Shrinks an uploaded picture so it stays small; keeps transparency (logos and stamps are usually PNG). */
async function imageToDataUrl(file: File, maxSide: number): Promise<string> {
  if (!/^image\/(png|jpeg)$/.test(file.type)) throw new Error('Use a PNG or JPG image');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read the image');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let url = canvas.toDataURL('image/png');
  if (url.length > 500_000) url = canvas.toDataURL('image/jpeg', 0.85);
  return url;
}

const brandingKinds: Array<{ kind: BrandingKind; title: string; hint: string; max: number }> = [
  { kind: 'logo', title: 'School logo (optional)', hint: 'Printed top left. Leave empty to use the Kilimanjaro Schools badge.', max: 400 },
  { kind: 'stamp', title: 'School stamp (optional)', hint: 'Printed at the bottom right of the invoice.', max: 500 },
];

const swatches = ['#d59a1b', '#00334f', '#0f766e', '#7c3aed', '#be123c', '#1d4ed8'];

export function InvoiceBrandingPage() {
  const { data: settings, isLoading, isError, refetch, error } = useFinanceSettings();
  const update = useUpdateFinanceSettings();
  const upload = useUploadBrandingImage();
  const removeImage = useRemoveBrandingImage();
  const [form, setForm] = useState({ accentColor: '#d59a1b', invoiceTitle: 'INVOICE', invoiceNote: '', signatoryName: '', residenceChangePolicy: 'ASK' as 'NEXT_TERM' | 'THIS_TERM' | 'ASK' });
  const files = useRef<Partial<Record<BrandingKind, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (settings) setForm({ accentColor: settings.accentColor, invoiceTitle: settings.invoiceTitle, invoiceNote: settings.invoiceNote, signatoryName: settings.signatoryName, residenceChangePolicy: settings.residenceChangePolicy });
  }, [settings]);

  const dirty = !!settings && (form.accentColor !== settings.accentColor || form.invoiceTitle !== settings.invoiceTitle || form.invoiceNote !== settings.invoiceNote || form.signatoryName !== settings.signatoryName || form.residenceChangePolicy !== settings.residenceChangePolicy);

  const save = () =>
    update.mutate(form, { onSuccess: () => toast('Saved', 'success'), onError: (e) => toast(errorMessage(e, 'Could not save'), 'error') });

  const pick = async (kind: BrandingKind, file?: File | null, max = 400) => {
    if (!file) return;
    try {
      const dataUrl = await imageToDataUrl(file, max);
      upload.mutate({ kind, dataUrl }, { onSuccess: () => toast('Image saved', 'success'), onError: (e) => toast(errorMessage(e, 'Could not upload the image'), 'error') });
    } catch (e) {
      toast(errorMessage(e, 'Could not read the image'), 'error');
    }
  };

  return (
    <FinanceWorkspaceShell title="Invoice Look & Billing Rules" eyebrow="School branding">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Fee Setup' }, { label: 'Invoice Look' }]} />
      <NeedSchool>
        {isLoading ? <SkeletonTable cols={3} /> : isError || !settings ? <DataError message={errorMessage(error, "Could not load the settings.")} onRetry={refetch} /> : (
          <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-gutter">
              <section className="rounded-lg border border-[#d5dde6] bg-white p-5">
                <h2 className="font-display text-xl font-black text-[#00334f]">Pictures on the invoice</h2>
                <p className="mt-1 text-sm font-semibold text-[#64748b]">Invoices carry the Kilimanjaro Schools logo by default.</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {brandingKinds.map(({ kind, title, hint, max }) => (
                    <div key={kind} className="rounded-lg border border-[#d5dde6] p-4">
                      <p className="font-black text-[#00334f]">{title}</p>
                      <div className="mt-3 grid h-28 place-items-center rounded border border-dashed border-[#d5dde6] bg-[#f7f9fb]">
                        {settings.images[kind] ? <img src={settings.images[kind]!} alt={title} className="max-h-24 max-w-full object-contain" /> : <ImageIcon className="h-8 w-8 text-slate-300" />}
                      </div>
                      <p className="mt-2 text-xs font-semibold text-[#64748b]">{hint}</p>
                      <input ref={(el) => { files.current[kind] = el; }} type="file" accept="image/png,image/jpeg" className="hidden" aria-label={`Upload ${title}`} onChange={(e) => { void pick(kind, e.target.files?.[0], max); e.target.value = ''; }} />
                      <div className="mt-3 flex gap-2">
                        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" loading={upload.isPending && upload.variables?.kind === kind} onClick={() => files.current[kind]?.click()}><Upload className="h-3.5 w-3.5" /> {settings.images[kind] ? 'Replace' : 'Upload'}</Button>
                        {settings.images[kind] && <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => removeImage.mutate(kind, { onSuccess: () => toast('Image removed', 'success') })}><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-[#d5dde6] bg-white p-5">
                <h2 className="font-display text-xl font-black text-[#00334f]">Look and wording</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <span className={cap}>Accent colour</span>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {swatches.map((c) => (
                        <button key={c} type="button" aria-label={`Use ${c}`} onClick={() => setForm({ ...form, accentColor: c })} className={`h-9 w-9 rounded-full border-2 ${form.accentColor.toLowerCase() === c ? 'border-[#00334f] ring-2 ring-[#00334f]/30' : 'border-white shadow'}`} style={{ background: c }} />
                      ))}
                      <input type="color" aria-label="Pick any colour" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border border-[#d5dde6]" />
                    </div>
                  </div>
                  <label><span className={cap}>Document title</span><input value={form.invoiceTitle} maxLength={40} onChange={(e) => setForm({ ...form, invoiceTitle: e.target.value })} className={input} /></label>
                  <label className="md:col-span-2"><span className={cap}>Note at the bottom</span><textarea value={form.invoiceNote} maxLength={400} rows={2} onChange={(e) => setForm({ ...form, invoiceNote: e.target.value })} placeholder="Payment of 100% of the fees for the term is preferred." className="mt-1 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] p-3 text-sm font-semibold outline-none focus:border-[#00334f]" /></label>
                </div>
              </section>

              <section className="rounded-lg border border-[#d5dde6] bg-white p-5">
                <h2 className="font-display text-xl font-black text-[#00334f]">When a student moves between in campus and off campus</h2>
                <p className="mt-1 text-sm font-semibold text-[#64748b]">Which term should the new fee apply from? Invoices are never changed automatically. Finance always previews and confirms.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Residence change policy">
                  {([['NEXT_TERM', 'From next term', 'The change waits for the next term. Safest for invoices already sent.'], ['THIS_TERM', 'From this term', 'Applies now. This term\'s invoice is marked for review.'], ['ASK', 'Ask each time', 'The person making the change chooses.']] as const).map(([v, title, hint]) => (
                    <button key={v} type="button" role="radio" aria-checked={form.residenceChangePolicy === v} onClick={() => setForm({ ...form, residenceChangePolicy: v })} className={`rounded-xl border-2 p-4 text-left ${form.residenceChangePolicy === v ? 'border-[#00334f] bg-[#eef5f8]' : 'border-[#d5dde6] hover:border-[#00334f]/50'}`}>
                      <span className="block font-black text-[#00334f]">{title}</span>
                      <span className="mt-1 block text-xs font-semibold text-[#64748b]">{hint}</span>
                    </button>
                  ))}
                </div>
              </section>

              <div className="flex items-center gap-3">
                <Button className="rounded bg-[#00334f]" disabled={!dirty} loading={update.isPending} onClick={save}>Save changes</Button>
                {dirty && <span className="text-sm font-semibold text-amber-700">You have unsaved changes</span>}
              </div>
            </div>

            <aside className="space-y-gutter">
              <section className="rounded-lg border border-[#d5dde6] bg-white p-5">
                <h3 className="font-display text-base font-black text-[#00334f]">Check how it looks</h3>
                <p className="mt-1 text-sm font-semibold text-[#64748b]">Opens a sample invoice using what is saved here and the school payment info.</p>
                <Button variant="secondary" className="mt-3 rounded" onClick={() => openSampleInvoice().catch((e) => toast(errorMessage(e, 'Could not open the sample'), 'error'))}><Eye className="h-4 w-4" /> Preview invoice</Button>
                {dirty && <p className="mt-2 text-xs font-semibold text-amber-700">Save first to see your latest changes.</p>}
              </section>
            </aside>
          </div>
        )}
      </NeedSchool>
    </FinanceWorkspaceShell>
  );
}

// ─── Payment plans ───────────────────────────────────────────────────────────────────

type Row = { key: string; groupLabel: string; label: string; mode: 'percent' | 'fixed' | 'rest'; value: string; dueMode: 'date' | 'days'; dueDate: string; days: string };
let rowSeed = 0;
const newRow = (over: Partial<Row> = {}): Row => ({ key: `r${++rowSeed}`, groupLabel: '', label: '', mode: 'percent', value: '', dueMode: 'days', dueDate: '', days: '0', ...over });

type Draft = {
  id?: string;
  name: string;
  description: string;
  residenceType: '' | 'BOARDING' | 'DAY_SCHOLAR';
  educationStage: string;
  classLevel: string;
  academicYearId: string;
  termId: string;
  coveredCategoryIds: string[];
  otherItemsLabel: string;
  otherItemsDueDays: string;
  rows: Row[];
};

const emptyDraft = (): Draft => ({ name: '', description: '', residenceType: '', educationStage: '', classLevel: '', academicYearId: '', termId: '', coveredCategoryIds: [], otherItemsLabel: 'Other items', otherItemsDueDays: '0', rows: [newRow({ label: 'First instalment', value: '50', days: '0' }), newRow({ label: 'Second instalment', value: '50', days: '60' })] });

const toInstallments = (rows: Row[]): PlanInstallmentInput[] =>
  rows.map((r) => ({
    groupLabel: r.groupLabel.trim() || undefined,
    label: r.label.trim(),
    ...(r.mode === 'percent' ? { percent: Number(r.value) } : r.mode === 'fixed' ? { fixedAmount: Number(r.value) } : { isRemainder: true }),
    ...(r.dueMode === 'date' ? (r.dueDate ? { dueDate: r.dueDate } : {}) : { dueDaysAfterIssue: Number(r.days) || 0 }),
  }));

function draftFromPlan(p: PaymentPlan): Draft {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    residenceType: p.residenceType ?? '',
    educationStage: p.educationStage ?? '',
    classLevel: p.classLevel != null ? String(p.classLevel) : '',
    academicYearId: p.academicYearId ?? '',
    termId: p.termId ?? '',
    coveredCategoryIds: p.coveredCategoryIds ?? [],
    otherItemsLabel: p.otherItemsLabel ?? 'Other items',
    otherItemsDueDays: String(p.otherItemsDueDays ?? 0),
    rows: p.installments.map((i) => newRow({
      groupLabel: i.groupLabel ?? '',
      label: i.label,
      mode: i.isRemainder ? 'rest' : i.fixedAmount ? 'fixed' : 'percent',
      value: i.isRemainder ? '' : String(Number(i.fixedAmount ?? i.percent ?? 0)),
      dueMode: i.dueDate ? 'date' : 'days',
      dueDate: toDateInput(i.dueDate),
      days: String(i.dueDaysAfterIssue ?? 0),
    })),
  };
}

const describePlan = (p: PaymentPlan) =>
  p.installments.map((i) => `${i.isRemainder ? 'the rest' : i.fixedAmount ? money(Number(i.fixedAmount)) : `${Number(i.percent)}%`}`).join(' · ');

export function PaymentPlansPage() {
  const { data: plans = [], isLoading, isError, refetch } = usePaymentPlans(true);
  const { data: categories = [] } = useFeeCategories() as unknown as { data: Array<{ id: string; name: string }> };
  const { data: years = [] } = useFinanceAcademicYears();
  const { data: terms = [] } = useFinanceTerms();
  const create = useCreatePaymentPlan();
  const updatePlan = useUpdatePaymentPlan();
  const setActive = useSetPlanActive();
  const applyToTerm = useApplyPlansToTerm();
  const preview = usePreviewPlan();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sample, setSample] = useState({ split: '4740000', other: '1600000' });
  const [applyTerm, setApplyTerm] = useState('');
  const [previewData, setPreviewData] = useState<{ errors: string[]; rows: Array<{ label: string; groupLabel: string | null; description: string | null; amount: number; dueDate: string }> } | null>(null);

  const termYear = (termId: string) => (terms as Array<{ id: string; academicYearId: string }>).find((t) => t.id === termId)?.academicYearId ?? '';

  // Keep the preview in step with the draft.
  const draftKey = useMemo(() => JSON.stringify({ r: draft?.rows, s: sample, c: draft?.coveredCategoryIds.length, o: draft?.otherItemsLabel, d: draft?.otherItemsDueDays }), [draft, sample]);
  useEffect(() => {
    if (!draft) { setPreviewData(null); return; }
    const timer = setTimeout(() => {
      const installments = toInstallments(draft.rows);
      preview.mutate(
        { installments, amountToSplit: Number(sample.split) || 0, otherAmount: draft.coveredCategoryIds.length ? Number(sample.other) || 0 : 0, otherItemsLabel: draft.otherItemsLabel || undefined, otherItemsDueDays: Number(draft.otherItemsDueDays) || 0 },
        { onSuccess: setPreviewData, onError: () => setPreviewData(null) },
      );
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) { toast('Give the plan a name', 'error'); return; }
    if (previewData?.errors.length) { toast(previewData.errors[0], 'error'); return; }
    const body = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      residenceType: draft.residenceType || null,
      educationStage: draft.educationStage || null,
      classLevel: draft.classLevel ? Number(draft.classLevel) : null,
      academicYearId: draft.academicYearId || null,
      termId: draft.termId || null,
      coveredCategoryIds: draft.coveredCategoryIds,
      otherItemsLabel: draft.otherItemsLabel.trim() || undefined,
      otherItemsDueDays: Number(draft.otherItemsDueDays) || 0,
      installments: toInstallments(draft.rows),
    };
    const done = { onSuccess: () => { toast('Payment plan saved', 'success'); setDraft(null); }, onError: (e: unknown) => toast(errorMessage(e, 'Could not save the plan'), 'error') };
    if (draft.id) updatePlan.mutate({ id: draft.id, ...body }, done);
    else create.mutate(body, done);
  };

  const setRow = (key: string, patch: Partial<Row>) => setDraft((d) => (d ? { ...d, rows: d.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) } : d));
  const presets: Array<[string, Row[]]> = [
    ['Pay in full', [newRow({ label: 'Full payment', value: '100', days: '14' })]],
    ['Two instalments (50/50)', [newRow({ label: 'First instalment', value: '50', days: '0' }), newRow({ label: 'Second instalment', value: '50', days: '60' })]],
    ['Three instalments (40/30/30)', [newRow({ label: 'First instalment', value: '40', days: '0' }), newRow({ label: 'Second instalment', value: '30', days: '45' }), newRow({ label: 'Third instalment', value: '30', days: '90' })]],
  ];

  return (
    <FinanceWorkspaceShell title="Payment Plans" eyebrow="Fee setup" action={<Button className="rounded bg-[#00334f]" onClick={() => setDraft(emptyDraft())}><Plus className="h-4 w-4" /> New plan</Button>}>
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Fee Setup' }, { label: 'Payment Plans' }]} />
      <NeedSchool>
        {!draft ? (
          <div className="space-y-gutter">
            <section className="rounded-lg border border-[#d5dde6] bg-white p-5">
              <h2 className="font-display text-xl font-black text-[#00334f]">How parents can pay</h2>
              <p className="text-sm font-semibold text-[#64748b]">A plan splits a fee, usually tuition, into instalments with due dates. Each new invoice gets the best matching plan and shows it to the parent. The invoice total never changes.</p>
              {isLoading ? <div className="mt-4"><SkeletonTable cols={3} /></div> : isError ? <DataError message="Could not load payment plans." onRetry={refetch} /> : plans.length === 0 ? (
                <div className="mt-4"><EmptyState title="No payment plans yet" description="Create one, for example 50% by the first deadline and 50% by the second. Without a plan, invoices are paid in one amount." /></div>
              ) : (
                <ul className="mt-4 grid gap-3 lg:grid-cols-2">
                  {plans.map((p) => (
                    <li key={p.id} className={`rounded-lg border p-4 ${p.isActive ? 'border-[#d5dde6]' : 'border-dashed border-[#d5dde6] opacity-70'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-[#00334f]">{p.name} {!p.isActive && <Badge tone="slate">Off</Badge>}</p>
                          <p className="text-xs font-semibold text-[#64748b]">{p.installments.length} instalment{p.installments.length === 1 ? '' : 's'}: {describePlan(p)}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setDraft(draftFromPlan(p))}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setActive.mutate({ id: p.id, isActive: !p.isActive })}><Power className="h-3.5 w-3.5" /> {p.isActive ? 'Off' : 'On'}</Button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold">
                        {p.residenceType && <Badge tone={p.residenceType === 'BOARDING' ? 'emerald' : 'blue'}>{p.residenceType === 'BOARDING' ? 'In campus' : 'Off campus'}</Badge>}
                        {p.educationStage && <Badge tone="gold">{p.educationStage.replaceAll('_', ' ')}{p.classLevel != null ? ` · level ${p.classLevel}` : ''}</Badge>}
                        {p.termId && <Badge tone="slate">{(terms as Array<{ id: string; name: string }>).find((t) => t.id === p.termId)?.name ?? 'One term'}</Badge>}
                        {!p.residenceType && !p.educationStage && !p.termId && <Badge tone="slate">All students</Badge>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-[#d5dde6] bg-white p-5">
              <h3 className="font-display text-base font-black text-[#00334f]">Invoices already sent</h3>
              <p className="mt-1 text-sm font-semibold text-[#64748b]">Give open invoices of a term that have no plan yet their best matching plan. Invoices that already have a plan are left alone.</p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label><span className={cap}>Term</span>
                  <select value={applyTerm} onChange={(e) => setApplyTerm(e.target.value)} className={`${input} w-64`}>
                    <option value="">Choose a term…</option>
                    {(terms as Array<{ id: string; name: string; isCurrent?: boolean }>).map((t) => <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? ' (current)' : ''}</option>)}
                  </select>
                </label>
                <Button variant="secondary" className="rounded" disabled={!applyTerm} loading={applyToTerm.isPending} onClick={() => applyToTerm.mutate({ academicYearId: termYear(applyTerm) || (years as Array<{ id: string; isCurrent?: boolean }>).find((y) => y.isCurrent)?.id || '', termId: applyTerm }, { onSuccess: (r) => toast(`${r.applied} invoice${r.applied === 1 ? '' : 's'} updated, ${r.skipped} had no matching plan`, 'success'), onError: (e) => toast(errorMessage(e, 'Could not apply the plans'), 'error') })}>Apply plans</Button>
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="rounded-lg border border-[#d5dde6] bg-white p-5">
              <h2 className="font-display text-xl font-black text-[#00334f]">{draft.id ? 'Edit plan' : 'New payment plan'}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label><span className={cap}>Plan name *</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Tuition in two instalments" className={input} /></label>
                <label><span className={cap}>Note (optional)</span><input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={input} /></label>
              </div>

              <div className="mt-6">
                <p className={cap}>Who gets this plan</p>
                <p className="text-xs font-semibold text-[#64748b]">Leave everything on &quot;any&quot; for all students. The most specific matching plan is used.</p>
                <div className="mt-2 grid gap-3 md:grid-cols-4">
                  <label><span className="text-[10px] font-black uppercase text-slate-400">Stays</span>
                    <select value={draft.residenceType} onChange={(e) => setDraft({ ...draft, residenceType: e.target.value as Draft['residenceType'] })} className={input}><option value="">Any</option><option value="BOARDING">In campus</option><option value="DAY_SCHOLAR">Off campus</option></select></label>
                  <label><span className="text-[10px] font-black uppercase text-slate-400">Stage</span>
                    <select value={draft.educationStage} onChange={(e) => setDraft({ ...draft, educationStage: e.target.value })} className={input}><option value="">Any</option><option value="NURSERY">Nursery</option><option value="PRIMARY">Primary</option><option value="O_LEVEL">O-Level</option><option value="A_LEVEL">A-Level</option></select></label>
                  <label><span className="text-[10px] font-black uppercase text-slate-400">Class level</span><input type="number" min={0} value={draft.classLevel} onChange={(e) => setDraft({ ...draft, classLevel: e.target.value })} placeholder="Any" className={input} /></label>
                  <label><span className="text-[10px] font-black uppercase text-slate-400">Term</span>
                    <select value={draft.termId} onChange={(e) => setDraft({ ...draft, termId: e.target.value, academicYearId: termYear(e.target.value) })} className={input}><option value="">Any</option>{(terms as Array<{ id: string; name: string }>).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                </div>
              </div>

              <div className="mt-6">
                <p className={cap}>Which fees are split into instalments</p>
                <p className="text-xs font-semibold text-[#64748b]">Pick the fees to split, usually tuition. Nothing ticked splits every fee. Fees not ticked are collected together as one &quot;other items&quot; payment.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const on = draft.coveredCategoryIds.includes(c.id);
                    return <button key={c.id} type="button" aria-pressed={on} onClick={() => setDraft({ ...draft, coveredCategoryIds: on ? draft.coveredCategoryIds.filter((x) => x !== c.id) : [...draft.coveredCategoryIds, c.id] })} className={`rounded-full border px-3 py-1 text-xs font-black ${on ? 'border-[#00334f] bg-[#00334f] text-white' : 'border-[#d5dde6] text-[#475569] hover:border-[#00334f]/50'}`}>{c.name}</button>;
                  })}
                </div>
                {draft.coveredCategoryIds.length > 0 && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label><span className="text-[10px] font-black uppercase text-slate-400">Name of the other-items payment</span><input value={draft.otherItemsLabel} onChange={(e) => setDraft({ ...draft, otherItemsLabel: e.target.value })} className={input} /></label>
                    <label><span className="text-[10px] font-black uppercase text-slate-400">Due (days after the invoice)</span><input type="number" min={0} value={draft.otherItemsDueDays} onChange={(e) => setDraft({ ...draft, otherItemsDueDays: e.target.value })} className={input} /></label>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={cap}>Instalments</p>
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map(([name, rows]) => <button key={name} type="button" onClick={() => setDraft({ ...draft, rows: rows.map((r) => newRow({ ...r })) })} className="rounded border border-[#d5dde6] px-2 py-1 text-[11px] font-black uppercase text-[#475569] hover:bg-[#eef5f8]">{name}</button>)}
                  </div>
                </div>
                <div className="mt-3 space-y-3">
                  {draft.rows.map((r, idx) => (
                    <div key={r.key} className="rounded-lg border border-[#d5dde6] p-3">
                      <div className="grid gap-2 sm:grid-cols-[110px_1fr_auto]">
                        <label><span className="text-[10px] font-black uppercase text-slate-400">Heading</span><input value={r.groupLabel} onChange={(e) => setRow(r.key, { groupLabel: e.target.value })} placeholder="Term I" className={`${input} !h-10`} /></label>
                        <label><span className="text-[10px] font-black uppercase text-slate-400">Name *</span><input value={r.label} onChange={(e) => setRow(r.key, { label: e.target.value })} placeholder={`Instalment ${idx + 1}`} className={`${input} !h-10`} /></label>
                        <button type="button" aria-label={`Remove instalment ${idx + 1}`} disabled={draft.rows.length <= 1} onClick={() => setDraft({ ...draft, rows: draft.rows.filter((x) => x.key !== r.key) })} className="mt-5 grid h-10 w-10 place-items-center rounded border border-[#d5dde6] text-rose-600 hover:bg-rose-50 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[150px_110px_1fr]">
                        <label><span className="text-[10px] font-black uppercase text-slate-400">Amount is</span>
                          <select value={r.mode} onChange={(e) => setRow(r.key, { mode: e.target.value as Row['mode'] })} className={`${input} !h-10`}><option value="percent">A percentage</option><option value="fixed">A fixed amount</option><option value="rest">The rest</option></select></label>
                        <label><span className="text-[10px] font-black uppercase text-slate-400">{r.mode === 'percent' ? 'Percent' : r.mode === 'fixed' ? 'TZS' : 'Remaining'}</span>
                          <input type="number" min={0} disabled={r.mode === 'rest'} value={r.value} onChange={(e) => setRow(r.key, { value: e.target.value })} className={`${input} !h-10`} /></label>
                        <div><span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-400"><CalendarClock className="h-3.5 w-3.5" /> Due</span>
                          <div className="mt-1 flex gap-2">
                            <select aria-label="How the due date is set" value={r.dueMode} onChange={(e) => setRow(r.key, { dueMode: e.target.value as Row['dueMode'] })} className="h-10 rounded border border-[#d5dde6] bg-[#f7f9fb] px-2 text-sm font-semibold"><option value="days">Days after invoice</option><option value="date">On a date</option></select>
                            {r.dueMode === 'date'
                              ? <input type="date" aria-label="Due date" value={r.dueDate} onChange={(e) => setRow(r.key, { dueDate: e.target.value })} className="h-10 min-w-0 flex-1 rounded border border-[#d5dde6] bg-[#f7f9fb] px-2 text-sm font-semibold" />
                              : <input type="number" min={0} aria-label="Days after invoice" value={r.days} onChange={(e) => setRow(r.key, { days: e.target.value })} className="h-10 w-20 rounded border border-[#d5dde6] bg-[#f7f9fb] px-2 text-sm font-semibold" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="secondary" className="mt-3 rounded" disabled={draft.rows.length >= 24} onClick={() => setDraft({ ...draft, rows: [...draft.rows, newRow({ days: String((Number(draft.rows.at(-1)?.days) || 0) + 30) })] })}><Plus className="h-4 w-4" /> Add instalment</Button>
              </div>

              <div className="mt-6 flex gap-2">
                <Button className="rounded bg-[#00334f]" loading={create.isPending || updatePlan.isPending} onClick={save}>Save plan</Button>
                <Button variant="secondary" className="rounded" onClick={() => setDraft(null)}>Cancel</Button>
              </div>
            </section>

            <aside className="space-y-gutter">
              <section className="rounded-lg border border-[#d5dde6] bg-white p-5">
                <h3 className="font-display text-base font-black text-[#00334f]">What a parent would see</h3>
                <p className="text-xs font-semibold text-[#64748b]">Try an example invoice.</p>
                <div className="mt-3 grid gap-3">
                  <label><span className="text-[10px] font-black uppercase text-slate-400">Fees split by the plan (TZS)</span><input type="number" value={sample.split} onChange={(e) => setSample({ ...sample, split: e.target.value })} className={`${input} !h-10`} /></label>
                  {draft.coveredCategoryIds.length > 0 && <label><span className="text-[10px] font-black uppercase text-slate-400">Other fees (TZS)</span><input type="number" value={sample.other} onChange={(e) => setSample({ ...sample, other: e.target.value })} className={`${input} !h-10`} /></label>}
                </div>
                {previewData?.errors.length ? (
                  <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800"><p>To finish this plan:</p><ul className="mt-1 space-y-1">{previewData.errors.map((e) => <li key={e}>• {e}</li>)}</ul></div>
                ) : previewData ? (
                  <table className="mt-3 w-full text-sm">
                    <tbody className="divide-y divide-[#eef2f6]">
                      {previewData.rows.map((r, i) => (
                        <tr key={i}><td className="py-2 pr-2 font-semibold text-slate-700">{[r.groupLabel, r.label].filter(Boolean).join(' ')}<span className="block text-[11px] font-semibold text-slate-400">by {dateText(r.dueDate)}</span></td><td className="py-2 text-right font-mono font-bold">{money(r.amount)}</td></tr>
                      ))}
                      <tr><td className="pt-2 font-black text-[#00334f]">Total</td><td className="pt-2 text-right font-mono font-black text-[#00334f]">{money(previewData.rows.reduce((s, r) => s + r.amount, 0))}</td></tr>
                    </tbody>
                  </table>
                ) : <p className="mt-3 text-sm font-semibold text-slate-400">Fill in the instalments to see the schedule.</p>}
              </section>
            </aside>
          </div>
        )}
      </NeedSchool>
    </FinanceWorkspaceShell>
  );
}

// ─── Plan on one invoice ─────────────────────────────────────────────────────────────

/** Instalments of one invoice with what is paid, plus apply / change / remove, and "tell the parent". */
export function InvoicePlanPanel({ invoiceId, status, total }: { invoiceId: string; status: string; total: number }) {
  const { data: plan, isLoading, isError } = useInvoicePlan(invoiceId);
  const { data: plans = [] } = usePaymentPlans(false);
  const apply = useApplyInvoicePlan();
  const clear = useClearInvoicePlan();
  const custom = useSetCustomInvoicePlan();
  const notify = useNotifyParentOfInvoice();
  const [choose, setChoose] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [editing, setEditing] = useState<Array<{ label: string; amount: string; dueDate: string }> | null>(null);
  const [reason, setReason] = useState('');
  const open = ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(status);
  const hasPlan = !!plan?.installments.length;

  const sum = (editing ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <section className="rounded-lg border border-[#d5dde6] bg-white p-5" aria-labelledby="invoice-plan-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-[#00334f]" />
          <h2 id="invoice-plan-heading" className="font-display text-lg font-black text-[#00334f]">Payment plan</h2>
          {plan?.isCustom && <Badge tone="gold">Custom</Badge>}
          {plan?.template && !plan.isCustom && <Badge tone="slate">{plan.template.name}</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" loading={notify.isPending} onClick={() => notify.mutate(invoiceId, { onSuccess: () => toast('The parent has been notified about this invoice', 'success'), onError: (e) => toast(errorMessage(e, 'Could not notify the parent'), 'error') })}><Send className="h-3.5 w-3.5" /> Notify parent</Button>
          {open && <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setChoose((v) => !v)}><FileText className="h-3.5 w-3.5" /> {hasPlan ? 'Change plan' : 'Apply plan'}</Button>}
          {open && hasPlan && <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setEditing(plan!.installments.map((i) => ({ label: [i.groupLabel, i.label].filter(Boolean).join(' '), amount: String(i.amount), dueDate: toDateInput(i.dueDate) })))}><Pencil className="h-3.5 w-3.5" /> Edit dates</Button>}
        </div>
      </div>

      {isLoading ? <div className="mt-4"><SkeletonTable cols={3} /></div> : isError ? <p className="mt-3 text-sm font-semibold text-rose-600">Could not load the payment plan.</p> : !hasPlan ? (
        <p className="mt-3 text-sm font-semibold text-[#64748b]">This invoice has no instalments. It is paid in one amount by the due date.{open ? ' Use Apply plan to split it.' : ''}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] font-black uppercase tracking-widest text-slate-500"><tr><th className="py-2 text-left">Instalment</th><th className="py-2 text-left">Due</th><th className="py-2 text-right">Amount</th><th className="py-2 text-right">Paid</th><th className="py-2 text-right">Balance</th></tr></thead>
            <tbody className="divide-y divide-[#eef2f6]">
              {plan!.installments.map((i) => (
                <tr key={i.id}>
                  <td className="py-2 font-semibold text-slate-800">{[i.groupLabel, i.label].filter(Boolean).join(' ')}{i.description ? <span className="block text-[11px] font-semibold text-slate-400">{i.description}</span> : null}</td>
                  <td className="py-2 font-semibold text-slate-600">{dateText(i.dueDate)} {i.overdue && <Badge tone="rose">Overdue</Badge>}</td>
                  <td className="py-2 text-right font-mono">{money(i.amount)}</td>
                  <td className="py-2 text-right font-mono text-emerald-700">{money(i.paid)}</td>
                  <td className="py-2 text-right font-mono font-bold">{money(i.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs font-semibold text-slate-400">Payments count against the earliest due instalment first.</p>
        </div>
      )}

      {choose && (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-[#f7f9fb] p-3">
          <label><span className={cap}>Plan</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={`${input} w-72`}><option value="">Best matching plan</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <Button className="rounded bg-[#00334f]" loading={apply.isPending} onClick={() => apply.mutate({ invoiceId, templateId: templateId || undefined }, { onSuccess: () => { toast('Plan applied', 'success'); setChoose(false); }, onError: (e) => toast(errorMessage(e, 'Could not apply the plan'), 'error') })}>Apply</Button>
          {hasPlan && <Button variant="secondary" className="rounded" loading={clear.isPending} onClick={() => clear.mutate(invoiceId, { onSuccess: () => { toast('Plan removed', 'success'); setChoose(false); } })}>Remove plan</Button>}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Edit instalments">
          <div className="w-full max-w-2xl rounded-xl border border-[#d5dde6] bg-white p-6 shadow-2xl">
            <h2 className="font-display text-xl font-black text-[#00334f]">Edit this invoice&apos;s instalments</h2>
            <p className="mt-1 text-sm font-semibold text-[#64748b]">For a family that agreed different amounts or dates. The amounts must add up to the invoice total of {money(total)}.</p>
            <div className="mt-4 space-y-2">
              {editing.map((r, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_140px_150px_auto] items-center gap-2">
                  <input aria-label="Name" value={r.label} onChange={(e) => setEditing(editing.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))} className={`${input} !mt-0 !h-10`} />
                  <input aria-label="Amount" type="number" value={r.amount} onChange={(e) => setEditing(editing.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)))} className={`${input} !mt-0 !h-10`} />
                  <input aria-label="Due date" type="date" value={r.dueDate} onChange={(e) => setEditing(editing.map((x, i) => (i === idx ? { ...x, dueDate: e.target.value } : x)))} className={`${input} !mt-0 !h-10`} />
                  <button type="button" aria-label="Remove" disabled={editing.length <= 1} onClick={() => setEditing(editing.filter((_, i) => i !== idx))} className="grid h-10 w-10 place-items-center rounded border border-[#d5dde6] text-rose-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <Button variant="secondary" className="rounded" onClick={() => setEditing([...editing, { label: '', amount: '', dueDate: '' }])}><Plus className="h-4 w-4" /> Add</Button>
            </div>
            <p className={`mt-3 text-sm font-black ${Math.round(sum * 100) === Math.round(total * 100) ? 'text-emerald-700' : 'text-rose-600'}`}>Adds up to {money(sum)} of {money(total)}</p>
            <label className="mt-3 block"><span className={cap}>Reason *</span><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: agreed with the parent on 12 March" className={input} /></label>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="bg-[#00334f]" loading={custom.isPending} disabled={reason.trim().length < 3 || Math.round(sum * 100) !== Math.round(total * 100) || editing.some((r) => !r.label.trim() || !r.dueDate)} onClick={() => custom.mutate({ invoiceId, reason: reason.trim(), installments: editing.map((r) => ({ label: r.label.trim(), amount: Number(r.amount), dueDate: r.dueDate })) }, { onSuccess: () => { toast('Instalments saved', 'success'); setEditing(null); setReason(''); }, onError: (e) => toast(errorMessage(e, 'Could not save'), 'error') })}>Save instalments</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

