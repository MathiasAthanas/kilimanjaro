import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, RefreshCw, Upload, X } from 'lucide-react';
import { api } from '../../../lib/api/client';
import { payloadOf } from '../../../lib/api/response';
import { toast } from '../../../lib/toast';
import { Button } from '../../../components/common/Button';
import { fetchAllUsers, toAdminUsers } from '../api/admin.hooks';
import {
  buildUsersWorkbook,
  readBulkUserFile,
  usersToCsv,
  type BulkUserUploadRow,
} from './bulkUserEditSpreadsheet';
import * as XLSX from 'xlsx';

type PreviewChange = { field: string; before: string | boolean | null; after: string | boolean | null };
type PreviewRow = {
  rowNumber: number;
  userId: string;
  name: string;
  role: string;
  changes: PreviewChange[];
  errors: string[];
  warnings: string[];
};
type Preview = {
  summary: { total: number; changed: number; unchanged: number; invalid: number };
  canCommit: boolean;
  rows: PreviewRow[];
};
type Credential = { userId: string; name: string; login: string; temporaryPassword: string };
type CommitResult = { message: string; updated: number; passwordResets: number; credentials: Credential[] };

function saveBlob(content: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function errorMessage(error: unknown): string {
  const candidate = error as { response?: { data?: { message?: string | string[]; data?: { message?: string } } }; message?: string };
  const message = candidate.response?.data?.data?.message ?? candidate.response?.data?.message ?? candidate.message;
  return Array.isArray(message) ? message.join(' ') : String(message ?? 'The operation could not be completed.');
}

export function BulkUserEditDialog({
  params,
  total,
  onCompleted,
}: {
  params: Record<string, string | number>;
  total: number;
  onCompleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BulkUserUploadRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<'export' | 'preview' | 'commit' | ''>('');
  const [resetMode, setResetMode] = useState<'NONE' | 'ALL' | 'SELECTED'>('NONE');
  const [selectedResetIds, setSelectedResetIds] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportParams = useMemo(() => {
    const { page: _page, limit: _limit, ...filters } = params;
    return filters;
  }, [params]);
  const changedRows = preview?.rows.filter((row) => row.changes.length && !row.errors.length) ?? [];

  const resetState = () => {
    setRows([]);
    setFileName('');
    setPreview(null);
    setResetMode('NONE');
    setSelectedResetIds(new Set());
    setConfirmed(false);
    setResult(null);
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    resetState();
  };

  const exportUsers = async (format: 'xlsx' | 'csv') => {
    setBusy('export');
    try {
      const users = toAdminUsers(await fetchAllUsers(exportParams));
      if (!users.length) throw new Error('There are no users in the current filtered view to export.');
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'xlsx') {
        XLSX.writeFile(buildUsersWorkbook(users), `users-bulk-edit-${stamp}.xlsx`, { compression: true });
      } else {
        saveBlob(usersToCsv(users), `users-bulk-edit-${stamp}.csv`, 'text/csv;charset=utf-8');
      }
      toast(`${users.length} users exported`, 'success');
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy('');
    }
  };

  const selectFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = await readBulkUserFile(file);
      setRows(parsed);
      setFileName(file.name);
      setPreview(null);
      setResult(null);
      setConfirmed(false);
    } catch (error) {
      setRows([]);
      setFileName('');
      toast(errorMessage(error), 'error');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const runPreview = async () => {
    if (!rows.length) return;
    setBusy('preview');
    try {
      const next = await api.post('/auth/users/bulk-edit/preview', { rows }, { timeout: 60_000 }).then(payloadOf) as Preview;
      setPreview(next);
      setSelectedResetIds(new Set());
      setResetMode('NONE');
      setConfirmed(false);
      if (next.summary.invalid) toast(`${next.summary.invalid} row(s) need attention`, 'error');
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy('');
    }
  };

  const commit = async () => {
    if (!preview?.canCommit || !confirmed) return;
    const resetUserIds = resetMode === 'ALL'
      ? changedRows.map((row) => row.userId)
      : resetMode === 'SELECTED'
        ? [...selectedResetIds]
        : [];
    setBusy('commit');
    try {
      const committed = await api.post('/auth/users/bulk-edit/commit', {
        rows,
        resetUserIds,
        confirmed: true,
      }, { timeout: 180_000 }).then(payloadOf) as CommitResult;
      setResult(committed);
      onCompleted();
      toast(committed.message, 'success');
    } catch (error) {
      toast(errorMessage(error), 'error');
      setPreview(null);
      setConfirmed(false);
    } finally {
      setBusy('');
    }
  };

  const downloadCredentials = () => {
    if (!result?.credentials.length) return;
    const lines = [
      ['name', 'login', 'temporary_password'],
      ...result.credentials.map((item) => [item.name, item.login, item.temporaryPassword]),
    ];
    const csv = `\uFEFF${lines.map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n')}`;
    saveBlob(csv, 'temporary-user-credentials.csv', 'text/csv;charset=utf-8');
  };

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="h-4 w-4" />
        Bulk Edit Users
      </Button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="bulk-edit-title">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
              <div>
                <h2 id="bulk-edit-title" className="text-xl font-black text-slate-950">Bulk Edit Users</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Export the current filtered group, edit approved fields, then review every difference before saving.</p>
              </div>
              <button type="button" onClick={close} disabled={!!busy} aria-label="Close bulk edit" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
              {result ? (
                <div className="space-y-5">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-center gap-3 text-emerald-900"><CheckCircle2 className="h-6 w-6" /><p className="font-black">{result.message}</p></div>
                    <p className="mt-2 text-sm font-semibold text-emerald-700">{result.passwordResets} temporary password{result.passwordResets === 1 ? '' : 's'} issued. All affected sessions were revoked.</p>
                  </div>
                  {result.credentials.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><p className="font-black text-amber-950">Temporary credentials</p><p className="text-xs font-semibold text-amber-700">Download now. Passwords are not included in later exports.</p></div>
                        <Button type="button" variant="secondary" onClick={downloadCredentials}><Download className="h-4 w-4" />Download credentials</Button>
                      </div>
                      <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-amber-200 bg-white">
                        {result.credentials.map((item) => <div key={item.userId} className="grid gap-1 border-b border-amber-100 px-4 py-3 text-sm last:border-0 sm:grid-cols-3"><strong>{item.name}</strong><span className="font-mono">{item.login}</span><span className="font-mono font-bold">{item.temporaryPassword}</span></div>)}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end"><Button type="button" onClick={close}>Done</Button></div>
                </div>
              ) : (
                <>
                  <section className="rounded-xl border border-slate-200 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div><p className="font-black text-slate-900">1. Export current user group</p><p className="mt-1 text-sm text-slate-500">The current search and filters match {total} user{total === 1 ? '' : 's'}. Existing passwords are never exported.</p></div>
                      <div className="flex gap-2">
                        <Button type="button" variant="secondary" disabled={busy === 'export'} onClick={() => exportUsers('csv')}><Download className="h-4 w-4" />CSV</Button>
                        <Button type="button" disabled={busy === 'export'} onClick={() => exportUsers('xlsx')}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 p-5">
                    <p className="font-black text-slate-900">2. Upload the edited file</p>
                    <p className="mt-1 text-sm text-slate-500">Accepted: .xlsx, .xls, or .csv. Maximum 2,000 users. User ID, role, school membership, and export timestamp must remain unchanged.</p>
                    <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} />
                    <button type="button" onClick={() => fileInput.current?.click()} className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-7 text-sm font-black text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700">
                      <Upload className="h-5 w-5" />{fileName || 'Choose edited user file'}
                    </button>
                    {rows.length > 0 && <div className="mt-4 flex justify-end"><Button type="button" loading={busy === 'preview'} onClick={runPreview}><RefreshCw className="h-4 w-4" />Preview {rows.length} rows</Button></div>}
                  </section>

                  {preview && (
                    <section className="space-y-4 rounded-xl border border-slate-200 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><p className="font-black text-slate-900">3. Review changes</p><p className="mt-1 text-sm text-slate-500">Nothing has been saved yet.</p></div>
                        <div className="flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700">{preview.summary.changed} changed</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">{preview.summary.unchanged} unchanged</span><span className={`rounded-full px-3 py-1.5 ${preview.summary.invalid ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{preview.summary.invalid} invalid</span></div>
                      </div>
                      <div className="max-h-80 overflow-auto rounded-xl border border-slate-200">
                        {preview.rows.map((row) => (
                          <div key={`${row.rowNumber}-${row.userId}`} className="border-b border-slate-100 p-4 last:border-0">
                            <div className="flex flex-wrap items-center justify-between gap-2"><div><strong className="text-sm text-slate-900">Row {row.rowNumber}: {row.name}</strong><span className="ml-2 text-xs font-bold text-slate-400">{row.role}</span></div><span className={`text-xs font-black ${row.errors.length ? 'text-rose-600' : row.changes.length ? 'text-indigo-600' : 'text-slate-400'}`}>{row.errors.length ? 'Needs correction' : row.changes.length ? `${row.changes.length} change${row.changes.length === 1 ? '' : 's'}` : 'No change'}</span></div>
                            {row.changes.length > 0 && <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">{row.changes.map((change) => <p key={change.field}><strong>{change.field}:</strong> <span className="line-through opacity-60">{String(change.before ?? '(empty)')}</span> {' -> '} <span className="font-bold text-slate-900">{String(change.after ?? '(empty)')}</span></p>)}</div>}
                            {row.errors.map((message) => <p key={message} className="mt-2 text-xs font-bold text-rose-600">{message}</p>)}
                          </div>
                        ))}
                      </div>

                      {preview.canCommit && (
                        <div className="space-y-4 rounded-xl bg-slate-50 p-4">
                          <div><p className="text-sm font-black text-slate-900">Password handling</p><p className="text-xs font-semibold text-slate-500">Leave passwords unchanged, reset all changed users, or select specific changed users. Resets require a password change at next login.</p></div>
                          <div className="flex flex-wrap gap-2">
                            {([['NONE', 'Keep passwords'], ['ALL', 'Reset all changed'], ['SELECTED', 'Choose users']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setResetMode(value)} className={`rounded-lg border px-3 py-2 text-xs font-black ${resetMode === value ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'}`}>{label}</button>)}
                          </div>
                          {resetMode === 'SELECTED' && <div className="grid max-h-44 gap-2 overflow-auto rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">{changedRows.map((row) => <label key={row.userId} className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={selectedResetIds.has(row.userId)} onChange={(event) => setSelectedResetIds((current) => { const next = new Set(current); event.target.checked ? next.add(row.userId) : next.delete(row.userId); return next; })} />{row.name}</label>)}</div>}
                          <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900"><input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I reviewed the affected users and field changes. I understand this updates {preview.summary.changed} live account{preview.summary.changed === 1 ? '' : 's'}.</span></label>
                          <div className="flex justify-end"><Button type="button" loading={busy === 'commit'} disabled={!confirmed || (resetMode === 'SELECTED' && selectedResetIds.size === 0)} onClick={commit}>Apply reviewed changes</Button></div>
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
