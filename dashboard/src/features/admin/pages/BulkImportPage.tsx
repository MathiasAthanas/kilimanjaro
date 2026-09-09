import {
  AlertTriangle, BookOpen, CheckCircle2, ChevronDown, Download,
  FileSpreadsheet, GraduationCap, Upload, Users, X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useRef, useState } from 'react';
import { api } from '../../../lib/api/client';
import { Button } from '../../../components/common/Button';
import { AdminShell } from '../components/AdminConsole';
import {
  useAllAssessments,
  useAssessmentMarksSheet,
  useBulkMarksMutation,
} from '../../operations/api/operations.hooks';

// ── CSV helpers ───────────────────────────────────────────────────────────────

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trimStart().startsWith('#'));
  if (lines.length < 2) return { headers: [], rows: [] };
  const split = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };
  const headers = split(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = split(lines[i]);
    if (vals.every((v) => !v)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = vals[j] ?? ''; });
    rows.push(row);
  }
  return { headers, rows };
}

function downloadCsv(filename: string, headers: string[], sample: string[], comments: string[] = []) {
  const esc = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
  const content = [...comments, headers.join(','), sample.map(esc).join(',')].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ── Column guide component ────────────────────────────────────────────────────

function ColumnGuide({ cols }: { cols: Array<{ col: string; note: string; required?: boolean }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Column reference</p>
      </div>
      <div className="divide-y divide-slate-100">
        {cols.map((c) => (
          <div key={c.col} className="flex items-baseline gap-4 px-5 py-2.5">
            <span className="w-48 shrink-0 font-mono text-xs font-black text-indigo-600">
              {c.col}
              {c.required === false && <span className="ml-1 font-sans font-medium text-slate-400">(opt)</span>}
            </span>
            <span className="text-xs font-semibold text-slate-600">{c.note}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 bg-slate-50 px-5 py-2.5">
        <p className="text-[11px] font-semibold text-slate-400">
          First row must have exact column names above. Max 1 000 rows per upload.
        </p>
      </div>
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

function DropZone({ onFile, disabled }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={() => !disabled && ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition
        ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'}
        ${disabled ? 'pointer-events-none opacity-50' : ''}`}
    >
      <input ref={ref} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <Upload className="h-8 w-8 text-slate-400" />
      <div>
        <p className="text-sm font-bold text-slate-700">Drop your CSV here or click to browse</p>
        <p className="mt-0.5 text-xs text-slate-500">Only .csv files accepted</p>
      </div>
    </div>
  );
}

// ── Result banner ─────────────────────────────────────────────────────────────

function ResultBanner({
  result,
  onDismiss,
}: {
  result: { ok: true; message: string } | { ok: false; errors: string[] };
  onDismiss: () => void;
}) {
  if (result.ok) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-4">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <p className="text-sm font-semibold text-emerald-800 flex-1">{result.message}</p>
        <button onClick={onDismiss} className="text-emerald-500 hover:text-emerald-700"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-rose-50 border border-rose-200 px-5 py-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
        <div className="flex-1">
          <p className="text-sm font-bold text-rose-800">Import failed — {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}</p>
          <ul className="mt-2 space-y-1">
            {result.errors.slice(0, 12).map((e, i) => (
              <li key={i} className="text-xs text-rose-700">{e}</li>
            ))}
            {result.errors.length > 12 && (
              <li className="text-xs font-bold text-rose-500">…and {result.errors.length - 12} more errors</li>
            )}
          </ul>
        </div>
        <button onClick={onDismiss} className="text-rose-400 hover:text-rose-600"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100">
          <Icon className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="font-display text-base font-black text-slate-900">{title}</h2>
          <p className="text-xs font-semibold text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HISTORICAL RESULTS IMPORT
// ─────────────────────────────────────────────────────────────────────────────

const RESULTS_COLS = [
  { col: 'academic_year', note: 'Name of the academic year e.g. 2022/2023' },
  { col: 'term',         note: 'Term name e.g. Term 1' },
  { col: 'class_name',   note: 'Class name exactly as it appears in the system' },
  { col: 'subject_name', note: 'Subject name exactly as registered' },
  { col: 'student_registration', note: 'Student registration number' },
  { col: 'score',        note: 'Numeric score (0–100 scale or raw mark)', required: false },
  { col: 'max_score',    note: 'Maximum possible mark — leave blank if already on 100 scale', required: false },
  { col: 'grade',        note: 'Override grade (A/B/C/D/F) — leave blank to auto-calculate', required: false },
  { col: 'is_absent',    note: 'true if student was absent, blank otherwise', required: false },
  { col: 'education_stage', note: 'O_LEVEL, A_LEVEL, PRIMARY, NURSERY — leave blank to auto-detect', required: false },
  { col: 'remark',       note: 'Custom remark — leave blank to auto-generate', required: false },
];

const RESULTS_SAMPLE = [
  '2022/2023', 'Term 1', 'Form 4 A', 'Mathematics', 'STU-2022-001',
  '78', '100', '', '', '', '',
];

interface ImportReport {
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

function HistoricalResultsImport() {
  const [preview, setPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: true; message: string } | { ok: false; errors: string[] } | null>(null);

  function handleDownload() {
    downloadCsv(
      'historical_results_import_template.csv',
      RESULTS_COLS.map((c) => c.col),
      RESULTS_SAMPLE,
      ['# Kilimanjaro School — Historical Results Import Template'],
    );
  }

  function handleFile(file: File) {
    setResult(null);
    setPreview(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCsv(e.target?.result as string);
      if (!headers.length || !rows.length) {
        setResult({ ok: false, errors: ['No data rows found. Is the file empty?'] });
        return;
      }
      const required = ['academic_year', 'term', 'class_name', 'subject_name', 'student_registration'];
      const missing = required.filter((h) => !headers.includes(h));
      if (missing.length) {
        setResult({ ok: false, errors: missing.map((h) => `Missing required column: "${h}"`) });
        return;
      }
      if (rows.length > 1000) {
        setResult({ ok: false, errors: ['Maximum 1 000 rows per upload. Split your file and upload in batches.'] });
        return;
      }
      setPreview({ headers, rows });
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    setResult(null);
    try {
      const resp = await api.post<ImportReport | { data: ImportReport }>('/academics/import/results', { rows: preview.rows });
      const report: ImportReport = ('data' in (resp.data as object) && typeof (resp.data as Record<string, unknown>).data === 'object')
        ? (resp.data as { data: ImportReport }).data
        : (resp.data as ImportReport);
      if (report.errors && report.errors.length > 0) {
        setResult({ ok: false, errors: report.errors.map((e) => `Row ${e.row}: ${e.message}`) });
      } else {
        setResult({ ok: true, message: `Imported ${report.imported} of ${report.total} result records successfully.` });
        setPreview(null);
      }
    } catch (err: unknown) {
      const msg = (err instanceof Error) ? err.message : 'Import failed. Check your data and try again.';
      setResult({ ok: false, errors: [msg] });
    } finally {
      setImporting(false);
    }
  }

  return (
    <SectionCard icon={FileSpreadsheet} title="Historical Results" subtitle="Import term results from previous academic years (2015 onwards)">
      <ColumnGuide cols={RESULTS_COLS} />
      <Button variant="secondary" className="rounded-xl py-2 text-sm" onClick={handleDownload}>
        <Download className="h-4 w-4" /> Download results template
      </Button>

      {!preview && <DropZone onFile={handleFile} />}

      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-indigo-50 border border-indigo-200 px-5 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <p className="text-sm font-bold text-indigo-800">
                  {preview.rows.length} row{preview.rows.length !== 1 ? 's' : ''} ready to import
                </p>
              </div>
              <button className="text-indigo-400 hover:text-indigo-600" onClick={() => setPreview(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {preview.headers.slice(0, 6).map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-mono font-black text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                    {preview.headers.length > 6 && <th className="px-3 py-2 text-slate-400">+{preview.headers.length - 6} more</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {preview.headers.slice(0, 6).map((h) => (
                        <td key={h} className="px-3 py-2 text-slate-700 max-w-[140px] truncate">{row[h] || <span className="text-slate-300">—</span>}</td>
                      ))}
                      {preview.headers.length > 6 && <td className="px-3 py-2 text-slate-400">…</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 5 && (
                <p className="px-4 py-2 text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
                  Showing first 5 of {preview.rows.length} rows
                </p>
              )}
            </div>

            <Button
              onClick={handleImport}
              disabled={importing}
              className="w-full rounded-xl py-2.5"
            >
              {importing ? 'Importing…' : `Import ${preview.rows.length} result record${preview.rows.length !== 1 ? 's' : ''}`}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {result && <ResultBanner result={result} onDismiss={() => setResult(null)} />}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ASSESSMENT MARKS IMPORT
// ─────────────────────────────────────────────────────────────────────────────

function AssessmentMarksImport() {
  const { data: assessments = [] } = useAllAssessments();
  const [selectedId, setSelectedId] = useState('');
  const { data: sheet } = useAssessmentMarksSheet(selectedId || undefined);
  const bulkMutation = useBulkMarksMutation();

  const [preview, setPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [result, setResult] = useState<{ ok: true; message: string } | { ok: false; errors: string[] } | null>(null);

  function handleDownloadTemplate() {
    if (!sheet || !selectedId) return;
    const headers = ['student_registration', 'student_name', 'score', 'is_absent', 'note'];
    const rows = sheet.map((s: Record<string, unknown>) => [
      String(s.registrationNumber ?? s.studentId ?? ''),
      String(s.firstName ? `${s.firstName} ${s.lastName ?? ''}` : (s.student ?? s.name ?? '')),
      String(s.score ?? ''),
      String(s.isAbsent ?? ''),
      String(s.note ?? ''),
    ]);
    const esc = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [
      `# Assessment Marks — ${assessments.find((a) => a.id === selectedId)?.title ?? selectedId}`,
      headers.join(','),
      ...rows.map((r) => r.map(esc).join(',')),
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marks_sheet_${selectedId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  function handleFile(file: File) {
    setResult(null);
    setPreview(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCsv(e.target?.result as string);
      if (!headers.length || !rows.length) {
        setResult({ ok: false, errors: ['No data rows found.'] });
        return;
      }
      if (!headers.includes('student_registration')) {
        setResult({ ok: false, errors: ['Column "student_registration" is required.'] });
        return;
      }
      setPreview({ headers, rows });
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!preview || !selectedId) return;
    setResult(null);

    // Build marks from preview rows
    // We need studentId from the marks sheet. Map regNum → studentId
    const regToStudentId = new Map<string, string>();
    if (sheet) {
      for (const s of sheet as Record<string, unknown>[]) {
        const reg = String(s.registrationNumber ?? '').trim().toUpperCase();
        const sid = String(s.studentId ?? '');
        if (reg && sid) regToStudentId.set(reg, sid);
      }
    }

    const errors: string[] = [];
    const marks: Array<{ studentId: string; score?: number; isAbsent?: boolean; note?: string }> = [];
    preview.rows.forEach((row, i) => {
      const reg = String(row.student_registration ?? '').trim().toUpperCase();
      const studentId = regToStudentId.get(reg);
      if (!studentId) {
        errors.push(`Row ${i + 2}: registration "${row.student_registration}" not found in this assessment's class.`);
        return;
      }
      const isAbsent = ['true', '1', 'yes'].includes(String(row.is_absent ?? '').toLowerCase());
      const score = row.score?.trim() ? parseFloat(row.score) : undefined;
      marks.push({ studentId, score: isAbsent ? undefined : score, isAbsent, note: row.note?.trim() || undefined });
    });

    if (errors.length) {
      setResult({ ok: false, errors });
      return;
    }

    try {
      await bulkMutation.mutateAsync({ assessmentId: selectedId, marks });
      setResult({ ok: true, message: `Marks updated for ${marks.length} student${marks.length !== 1 ? 's' : ''}.` });
      setPreview(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setResult({ ok: false, errors: [msg] });
    }
  }

  const selectedAssessment = assessments.find((a) => a.id === selectedId);

  return (
    <SectionCard icon={BookOpen} title="Assessment Marks" subtitle="Download a pre-filled marks sheet, enter scores offline, then re-upload">
      <ColumnGuide cols={[
        { col: 'student_registration', note: 'Auto-filled — do not change' },
        { col: 'student_name',         note: 'Auto-filled for reference only', required: false },
        { col: 'score',                note: 'Numeric score', required: false },
        { col: 'is_absent',            note: 'true if absent, blank otherwise', required: false },
        { col: 'note',                 note: 'Optional remark', required: false },
      ]} />

      {/* Assessment selector */}
      <div className="space-y-2">
        <label className="text-xs font-black uppercase tracking-widest text-slate-500">Select assessment</label>
        <div className="relative">
          <select
            value={selectedId}
            onChange={(e) => { setSelectedId(e.target.value); setPreview(null); setResult(null); }}
            className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-9 text-sm font-semibold text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">— Choose an assessment —</option>
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>{a.title} ({a.className} · {a.subject})</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {selectedId && (
        <Button
          variant="secondary"
          className="rounded-xl py-2 text-sm"
          onClick={handleDownloadTemplate}
          disabled={!sheet}
        >
          <Download className="h-4 w-4" />
          {sheet ? `Download marks sheet (${(sheet as unknown[]).length} students)` : 'Loading student list…'}
        </Button>
      )}

      {selectedId && (
        <>
          {!preview && <DropZone onFile={handleFile} disabled={!selectedId} />}
          <AnimatePresence>
            {preview && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-indigo-50 border border-indigo-200 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                    <p className="text-sm font-bold text-indigo-800">
                      {preview.rows.length} mark row{preview.rows.length !== 1 ? 's' : ''} ready
                    </p>
                  </div>
                  <button className="text-indigo-400 hover:text-indigo-600" onClick={() => setPreview(null)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Button onClick={handleImport} disabled={bulkMutation.isPending} className="w-full rounded-xl py-2.5">
                  {bulkMutation.isPending ? 'Uploading…' : `Upload marks for ${selectedAssessment?.title ?? 'assessment'}`}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {result && <ResultBanner result={result} onDismiss={() => setResult(null)} />}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. STUDENT IMPORT (pointer to existing flow with enhanced template)
// ─────────────────────────────────────────────────────────────────────────────

function StudentBulkImport() {
  function handleDownload() {
    downloadCsv(
      'student_import_template.csv',
      [
        'first_name', 'last_name', 'date_of_birth', 'gender', 'class_name',
        'guardian_first_name', 'guardian_phone',
        'middle_name', 'guardian_last_name', 'guardian_relationship', 'guardian_email',
        'academic_year', 'nationality', 'admission_date',
      ],
      [
        'Amina', 'Mwanga', '2010-03-15', 'FEMALE', 'Form 2 A',
        'Juma', '+255712345678',
        '', 'Mwanga', 'FATHER', 'juma.mwanga@email.com',
        '2024/2025', 'Tanzanian', '2024-01-15',
      ],
      ['# Kilimanjaro School — Student Import Template'],
    );
  }

  return (
    <SectionCard icon={Users} title="Students" subtitle="Import new students with guardian accounts — use this for enrolment of historical cohorts">
      <ColumnGuide cols={[
        { col: 'first_name',            note: 'First name only' },
        { col: 'last_name',             note: 'Last name — used as initial password' },
        { col: 'date_of_birth',         note: 'Format: YYYY-MM-DD e.g. 2010-03-15' },
        { col: 'gender',                note: 'MALE or FEMALE' },
        { col: 'class_name',            note: 'Exact class name e.g. Form 2 A' },
        { col: 'guardian_first_name',   note: 'Parent / guardian first name' },
        { col: 'guardian_phone',        note: 'Guardian mobile with country code e.g. +255712345678' },
        { col: 'middle_name',           note: 'Optional', required: false },
        { col: 'guardian_last_name',    note: 'Optional — defaults to student last name', required: false },
        { col: 'guardian_relationship', note: 'FATHER · MOTHER · GUARDIAN · SIBLING · OTHER — optional', required: false },
        { col: 'guardian_email',        note: 'Optional', required: false },
        { col: 'academic_year',         note: 'Optional — defaults to current year', required: false },
        { col: 'nationality',           note: 'Optional — defaults to Tanzanian', required: false },
        { col: 'admission_date',        note: 'Optional — format YYYY-MM-DD', required: false },
      ]} />
      <Button variant="secondary" className="rounded-xl py-2 text-sm" onClick={handleDownload}>
        <Download className="h-4 w-4" /> Download student template
      </Button>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <p className="text-sm font-bold text-slate-700">Use the Students section in Admin Console to upload</p>
        <p className="mt-1 text-xs text-slate-500">
          Download the template above, fill it in, then go to{' '}
          <a href="/admin/students" className="font-semibold text-indigo-600 hover:underline">Admin → Students</a>{' '}
          and use the CSV Import tool there. The download above matches the exact format expected.
        </p>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function BulkImportPage() {
  return (
    <AdminShell
      eyebrow="Data Import"
      title="Bulk Import"
      subtitle="Upload CSV files to import historical records, results, and assessment marks"
    >
      <div className="space-y-6">
        <StudentBulkImport />
        <HistoricalResultsImport />
        <AssessmentMarksImport />
      </div>
    </AdminShell>
  );
}
