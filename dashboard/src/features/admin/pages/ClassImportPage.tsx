import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { AlertTriangle, CheckCircle2, ChevronDown, FileSpreadsheet, Upload, X } from 'lucide-react';
import { api } from '../../../lib/api/client';
import { payloadOf, arrayFromApi } from '../../../lib/api/response';
import { useSchoolStore } from '../../../lib/school/schoolStore';
import { Button } from '../../../components/common/Button';
import { AdminShell } from '../components/AdminConsole';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClassRow {
  id: string;
  name: string;
  stream?: string | null;
  educationStage?: string;
  schoolId?: string | null;
  academicYearId?: string;
  combinationCode?: string | null;
  combinationId?: string | null;
}

interface ParsedRow {
  admissionNumber?: string;
  name?: string;
  gender?: string;
  stream?: string;
  contacts?: string;
  dateOfBirth?: string;
}

interface ImportRowResult {
  line: number;
  name: string;
  admissionNumber?: string;
  status: 'ready' | 'imported' | 'warning' | 'error' | 'skipped';
  messages: string[];
  registrationNumber?: string;
  studentId?: string;
}

interface ImportReport {
  committed: boolean;
  school: { id: string | null; name: string; gender: string };
  class: { id: string; name: string; stream: string | null; educationStage: string; combinationCode: string | null };
  academicYearId: string;
  total: number; ready: number; imported: number; warnings: number; errors: number;
  createdStudentIds: string[];
  rows: ImportRowResult[];
}

// ── Column mapping (tolerant of legacy Kilimanjaro headers) ─────────────────────

const HEADER_MAP: Record<keyof ParsedRow, string[]> = {
  admissionNumber: ['admission number', 'admission_no', 'admission', 'adm no', 'adm', 'reg no', 'registration number'],
  name: ['name', 'full name', 'student name', 'names'],
  gender: ['gender', 'sex'],
  stream: ['stream', 'class stream', 'section'],
  contacts: ['contacts', 'contact', 'phone', 'guardian phone', 'guardian contact', 'parent phone'],
  dateOfBirth: ['date of birth', 'dob', 'date_of_birth', 'birth date'],
};

function normalizeHeader(h: string): keyof ParsedRow | null {
  const key = String(h ?? '').trim().toLowerCase();
  for (const field of Object.keys(HEADER_MAP) as (keyof ParsedRow)[]) {
    if (HEADER_MAP[field].includes(key)) return field;
  }
  return null;
}

/** Turn a matrix (array of arrays, first row = headers) into ParsedRows. */
function rowsFromMatrix(matrix: unknown[][]): { rows: ParsedRow[]; headers: string[]; unmapped: string[] } {
  const headerRow = (matrix[0] ?? []).map((h) => String(h ?? '').trim());
  const mapping = headerRow.map(normalizeHeader);
  const unmapped = headerRow.filter((h, i) => h && !mapping[i]);
  // separate first/middle/last support
  const firstIdx = headerRow.findIndex((h) => ['first name', 'first_name', 'firstname'].includes(h.toLowerCase()));
  const middleIdx = headerRow.findIndex((h) => ['middle name', 'middle_name', 'middlename'].includes(h.toLowerCase()));
  const lastIdx = headerRow.findIndex((h) => ['last name', 'last_name', 'lastname', 'surname'].includes(h.toLowerCase()));

  const rows: ParsedRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i] ?? [];
    if (cells.every((c) => c === undefined || c === null || String(c).trim() === '')) continue;
    const row: ParsedRow = {};
    mapping.forEach((field, idx) => {
      if (field) row[field] = String(cells[idx] ?? '').trim();
    });
    if (!row.name && (firstIdx >= 0 || lastIdx >= 0)) {
      row.name = [cells[firstIdx], cells[middleIdx], cells[lastIdx]].filter((c) => c != null && String(c).trim()).map((c) => String(c).trim()).join(' ');
    }
    rows.push(row);
  }
  return { rows, headers: headerRow, unmapped };
}

async function parseFile(file: File): Promise<{ rows: ParsedRow[]; headers: string[]; unmapped: string[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
  return rowsFromMatrix(matrix as unknown[][]);
}

// ── Data hook: classes for the active school ────────────────────────────────────

function useImportClasses() {
  const activeSchoolId = useSchoolStore((s) => s.activeSchool?.id ?? '__group__');
  return useQuery({
    queryKey: ['import', 'classes', activeSchoolId],
    queryFn: () => api.get('/students/classes').then((r) => arrayFromApi(payloadOf(r), ['classes']) as ClassRow[]),
    staleTime: 30_000,
  });
}

// ── Status pill ─────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: ImportRowResult['status'] }) {
  const map: Record<string, string> = {
    ready: 'bg-emerald-100 text-emerald-700',
    imported: 'bg-emerald-600 text-white',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-rose-100 text-rose-700',
    skipped: 'bg-slate-200 text-slate-600',
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${map[status]}`}>{status}</span>;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ClassImportPage() {
  const { data: classes = [], isLoading } = useImportClasses();
  const activeSchool = useSchoolStore((s) => s.activeSchool);
  const [classId, setClassId] = useState('');
  const [parsed, setParsed] = useState<{ rows: ParsedRow[]; headers: string[]; unmapped: string[] } | null>(null);
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<'idle' | 'preview' | 'commit'>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedClass = useMemo(() => classes.find((c) => c.id === classId), [classes, classId]);
  const isALevel = selectedClass?.educationStage === 'A_LEVEL';

  async function handleFile(file: File) {
    setError(null); setReport(null);
    setFileName(file.name);
    try {
      const result = await parseFile(file);
      if (!result.rows.length) { setError('No data rows found in the file.'); setParsed(null); return; }
      if (!result.headers.some((h) => normalizeHeader(h) === 'name') && !result.rows.some((r) => r.name)) {
        setError('Could not find a "Name" column. Expected headers like: Admission Number, Name, Stream, Contacts, Gender.');
        setParsed(null); return;
      }
      setParsed(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read file');
      setParsed(null);
    }
  }

  async function runImport(commit: boolean) {
    if (!selectedClass || !parsed) return;
    setBusy(commit ? 'commit' : 'preview');
    setError(null);
    try {
      const resp = await api.post('/students/import', {
        classId: selectedClass.id,
        commit,
        rows: parsed.rows,
      });
      const rep = payloadOf(resp) as ImportReport;
      setReport(rep);
      // A-Level: enrol imported students into the combination subjects.
      if (commit && isALevel && selectedClass.combinationId && rep.createdStudentIds.length) {
        try {
          await api.post('/academics/student-subject-enrollments/bulk-combination', {
            classId: selectedClass.id,
            academicYearId: rep.academicYearId,
            combinationId: selectedClass.combinationId,
            studentIds: rep.createdStudentIds,
          });
        } catch { /* subject enrolment is best-effort; import already succeeded */ }
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Import failed');
    } finally {
      setBusy('idle');
    }
  }

  return (
    <AdminShell eyebrow="Student Management" title="Class Student Import" subtitle="Pick a class, upload its list, preview, then import — students go only to that class and school.">
      <div className="space-y-6">
        {/* Step 1 — class */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Step 1 · Target class</p>
          {!activeSchool && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              Tip: select a school in the top bar to narrow the class list to that school.
            </p>
          )}
          <div className="relative mt-3 max-w-xl">
            <select
              value={classId}
              onChange={(e) => { setClassId(e.target.value); setReport(null); }}
              className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-9 text-sm font-semibold text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">{isLoading ? 'Loading classes…' : '— Choose a class —'}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.stream ? ` · ${c.stream}` : ''} ({String(c.educationStage ?? '').replace('_', '-')})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          {selectedClass && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
              <Chip label="Class" value={selectedClass.name} />
              {selectedClass.stream && <Chip label="Stream" value={selectedClass.stream} />}
              <Chip label="Stage" value={String(selectedClass.educationStage ?? '').replace('_', '-')} />
              {isALevel && <Chip label="Combination" value={selectedClass.combinationCode ?? '⚠ none attached'} tone={selectedClass.combinationCode ? 'indigo' : 'rose'} />}
            </div>
          )}
          {isALevel && !selectedClass?.combinationCode && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              This A-Level class has no subject combination attached. Attach one on the Classes page before importing.
            </p>
          )}
        </section>

        {/* Step 2 — file */}
        {selectedClass && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Step 2 · Upload class list</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">Accepts .xlsx or .csv. Recognised columns: Admission Number, Name, Stream, Contacts, Gender, Date of Birth. Only Name is required.</p>
            <div
              onClick={() => fileRef.current?.click()}
              className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              <Upload className="h-7 w-7 text-slate-400" />
              <p className="text-sm font-bold text-slate-700">{fileName || 'Click to choose an .xlsx or .csv file'}</p>
            </div>
            {parsed && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> {parsed.rows.length} rows parsed
                </span>
                {parsed.unmapped.length > 0 && (
                  <span className="text-xs font-semibold text-amber-600">Ignored columns: {parsed.unmapped.join(', ')}</span>
                )}
                <Button variant="secondary" className="rounded-xl px-4 py-2 text-sm" disabled={busy !== 'idle'} onClick={() => runImport(false)}>
                  {busy === 'preview' ? 'Validating…' : 'Preview & validate'}
                </Button>
              </div>
            )}
          </section>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Step 3 — report */}
        {report && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                Step 3 · {report.committed ? 'Import result' : 'Preview'} — {report.school.name}
              </p>
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <Chip label="Total" value={String(report.total)} />
                <Chip label={report.committed ? 'Imported' : 'Ready'} value={String(report.committed ? report.imported : report.ready)} tone="indigo" />
                {report.warnings > 0 && <Chip label="Warnings" value={String(report.warnings)} tone="amber" />}
                {report.errors > 0 && <Chip label="Errors" value={String(report.errors)} tone="rose" />}
              </div>
            </div>

            {!report.committed && report.ready > 0 && (
              <Button
                className="mt-4 rounded-xl px-5 py-2.5"
                disabled={busy !== 'idle' || (isALevel && !selectedClass?.combinationCode)}
                onClick={() => runImport(true)}
              >
                {busy === 'commit' ? 'Importing…' : `Import ${report.ready} student${report.ready !== 1 ? 's' : ''} into ${report.class.name}`}
              </Button>
            )}
            {report.committed && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Imported {report.imported} of {report.total} students into {report.class.name}.
              </div>
            )}

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {['Row', 'Status', 'Student', 'Admission', 'Reg No', 'Messages'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-black uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.rows.map((r, i) => (
                    <tr key={i} className={r.status === 'error' || r.status === 'skipped' ? 'bg-rose-50/40' : r.status === 'warning' ? 'bg-amber-50/40' : ''}>
                      <td className="px-3 py-2 text-slate-500">{r.line}</td>
                      <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                      <td className="px-3 py-2 font-bold text-slate-800">{r.name || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-slate-500">{r.admissionNumber || '—'}</td>
                      <td className="px-3 py-2 font-mono text-slate-600">{r.registrationNumber || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.messages.join(' ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  );
}

function Chip({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'indigo' | 'amber' | 'rose' }) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 ${map[tone]}`}>
      <span className="text-[10px] font-black uppercase opacity-70">{label}</span>
      <span>{value}</span>
    </span>
  );
}
