import {
  AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Copy,
  Download, Eye, FileText, Lock, Plus, Settings,
  Shield, Trash2, Upload, XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import type { ServiceState } from '../api/adminApi';
import { handlebarsIsValid, typedConfirmationIsValid } from '../utils/adminValidation';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { adminKeys } from '../api/admin.hooks';

// ─── Shell ────────────────────────────────────────────────────────────────────

export function AdminShell({ title, eyebrow, children, action }: { title: string; eyebrow: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="space-y-gutter">
      <section className="relative overflow-hidden rounded-2xl border border-indigo-300/30 bg-[radial-gradient(circle_at_8%_18%,rgba(14,165,233,0.30),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(99,102,241,0.22),transparent_32%),linear-gradient(135deg,#1E1B4B_0%,#312E81_50%,#4338CA_100%)] shadow-layer">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full border border-white/5" />
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-sky-400/60 to-transparent" />
        <div className="relative grid gap-6 p-8 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-sky-300">{eyebrow}</p>
            <h1 className="mt-2 font-display text-[44px] font-black leading-tight tracking-[-0.04em] text-white">{title}</h1>
            <p className="mt-1.5 text-sm font-semibold text-white/60">System Admin · admin@ks.ac.tz · Production console</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-start gap-2 xl:pt-2">
            <AdminHeaderPill label="Env"    value="Production" color="text-sky-300" />
            <AdminHeaderPill label="Status" value="Gateway ✓"  color="text-emerald-300" />
            <AdminHeaderPill label="Alerts" value="2 degraded" color="text-amber-300" />
            {action}
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}

function AdminHeaderPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="min-w-[110px] rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur">
      <p className="text-[9px] font-black uppercase tracking-widest text-white/50">{label}</p>
      <p className={`mt-1 font-mono text-sm font-black ${color}`}>{value}</p>
    </div>
  );
}

// ─── Metric strip ─────────────────────────────────────────────────────────────

export function AdminMetricStrip({ items }: { items: Array<{ label: string; value: string; detail: string; tone?: 'blue' | 'green' | 'amber' | 'rose' }> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.06, ease: 'easeOut' }}
          className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${toneBorder(item.tone)}`}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.label}</p>
          <p className="mt-2 font-display text-3xl font-black text-slate-950">{item.value}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{item.detail}</p>
        </motion.div>
      ))}
    </div>
  );
}

function toneBorder(tone?: string) {
  return tone === 'rose'  ? 'border-l-4 border-l-[#F43F5E]'
       : tone === 'amber' ? 'border-l-4 border-l-[#F59E0B]'
       : tone === 'green' ? 'border-l-4 border-l-[#10B981]'
       :                    'border-l-4 border-l-[#0EA5E9]';
}

// ─── Service health ───────────────────────────────────────────────────────────

export function AdminStatusIndicator({ service, state, uptime, latency }: { service: string; state: ServiceState; uptime: string; latency: string }) {
  const dotColor = state === 'ONLINE'   ? 'bg-[#10B981]'
                 : state === 'DEGRADED' ? 'bg-[#F59E0B]'
                 : state === 'OFFLINE'  ? 'bg-[#F43F5E]'
                 :                        'bg-slate-400';
  const ringColor = state === 'ONLINE'   ? 'ring-[#10B981]/25'
                  : state === 'DEGRADED' ? 'ring-[#F59E0B]/25'
                  :                        'ring-transparent';
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`relative flex h-3 w-3 rounded-full ${dotColor}`}>
          {(state === 'ONLINE' || state === 'DEGRADED') && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotColor}`} />
          )}
          <span className={`relative inline-flex h-3 w-3 rounded-full ring-4 ${dotColor} ${ringColor}`} />
        </span>
        <p className="text-sm font-black text-slate-900">{service}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-slate-400">{uptime}</span>
        <span className="text-[10px] font-bold text-slate-400">{latency}</span>
        <Badge tone={state === 'ONLINE' ? 'emerald' : state === 'DEGRADED' ? 'amber' : 'rose'}>{state}</Badge>
      </div>
    </div>
  );
}

// ─── Data table ───────────────────────────────────────────────────────────────

export function AdminDataTable({ columns, children, minWidth = 980 }: { columns: string[]; children: ReactNode; minWidth?: number; onSearch?: (q: string) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className="sticky top-0 bg-[#1E1B4B] text-[11px] font-black uppercase tracking-widest text-white">
            <tr>
              {columns.map((col) => <th key={col} className="px-5 py-4">{col}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-5 py-3.5 font-semibold text-slate-700 ${className}`}>{children}</td>;
}

// ─── Form primitives ──────────────────────────────────────────────────────────

/** Single-line text / date / number / email / tel input */
export function Field({
  label, value, type = 'text', placeholder = '', readOnly = false, onChange,
}: {
  label: string; value?: string; type?: string; placeholder?: string; readOnly?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const controlled = onChange !== undefined;
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <input
        {...(controlled ? { value: value ?? '' } : { defaultValue: value ?? '' })}
        onChange={onChange}
        type={type}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`mt-2 h-11 w-full rounded-xl border border-slate-200 px-4 font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white ${
          readOnly ? 'cursor-default bg-slate-100 text-slate-400' : 'bg-slate-50 hover:border-slate-300'
        }`}
      />
    </label>
  );
}

/** Dropdown select with options list */
export function SelectField({
  label, options, value = '', onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [val, setVal] = useState(value);
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <select
        value={val}
        onChange={(e) => { setVal(e.target.value); onChange?.(e.target.value); }}
        className="mt-2 h-11 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition hover:border-slate-300 focus:border-[#4338CA] focus:bg-white"
      >
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>
  );
}

/** On/off toggle switch */
export function FeatureToggle({ label, description, enabled = false }: { label: string; description: string; enabled?: boolean }) {
  const [on, setOn] = useState(enabled);
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3.5 transition hover:bg-slate-50/60">
      <div>
        <p className="text-sm font-black text-slate-900">{label}</p>
        <p className="text-xs font-semibold text-slate-500">{description}</p>
      </div>
      <button
        onClick={() => setOn((v) => !v)}
        aria-pressed={on}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA]/40 ${on ? 'bg-[#4338CA]' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${on ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

// ─── Form section (collapsible) ───────────────────────────────────────────────

export function AdminFormSection({ title, subtitle, children, badge }: { title: string; subtitle: string; children: ReactNode; badge?: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <button type="button" className="flex w-full items-start justify-between gap-4 text-left" onClick={() => setOpen((v) => !v)}>
        <div>
          <h2 className="font-display text-xl font-black text-slate-950">{title}</h2>
          <p className="mt-0.5 text-sm font-semibold text-slate-500">{subtitle}</p>
        </div>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          {badge}
          <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── CSV bulk import zone ─────────────────────────────────────────────────────

type CsvPreviewState = {
  headers: string[];
  previewRows: Record<string, string>[];
  allRows: Record<string, string>[];
};

type ImportLookup = {
  classes: Array<{ id: string; name?: string; academicYearId?: string }>;
  academicYears: Array<{ id: string; name?: string; isCurrent?: boolean }>;
};

const CSV_TEMPLATES: Record<string, { comments: string[]; headers: string[]; sample: string[] }> = {
  'staff user': {
    comments: [
      '# Staff User Import Template — Kilimanjaro Schools',
      '# role values: SYSTEM_ADMIN | BOARD_DIRECTOR | MANAGING_DIRECTOR | PRINCIPAL | ACADEMIC_QA | FINANCE | HEAD_OF_DEPARTMENT | TEACHER | PARENT',
      '# phone_number: include country code e.g. +255712345678',
      '# password is created automatically from LAST_NAME in uppercase',
      '# registration_number is optional and normally only used for student accounts',
    ],
    headers: ['first_name', 'last_name', 'email', 'phone_number', 'role', 'department', 'registration_number'],
    sample: ['John', 'Doe', 'john.doe@school.ac.tz', '+255712345678', 'TEACHER', 'Science', ''],
  },
  student: {
    comments: [
      '# Student Import Template — Kilimanjaro Schools',
      '# gender: MALE | FEMALE',
      '# guardian_relationship: FATHER | MOTHER | GUARDIAN | SIBLING | OTHER',
      '# date_of_birth and admission_date format: YYYY-MM-DD  e.g. 2010-03-15',
      '# class_name: must match an existing class name exactly  e.g. "Form 2 A"',
      '# academic_year: optional; uses current academic year when blank',
      '# password is created automatically from LAST_NAME in uppercase',
    ],
    headers: [
      'first_name', 'middle_name', 'last_name', 'date_of_birth', 'gender', 'nationality',
      'class_name', 'academic_year', 'admission_date',
      'guardian_first_name', 'guardian_last_name', 'guardian_relationship', 'guardian_phone', 'guardian_email',
    ],
    sample: [
      'Amina', 'Juma', 'Mwanga', '2010-03-15', 'FEMALE', 'Tanzanian',
      'Form 2 A', '', '2024-01-15',
      'Juma', 'Mwanga', 'FATHER', '+255712345678', 'juma.mwanga@email.com',
    ],
  },
};

const STAFF_ROLES = new Set([
  'SYSTEM_ADMIN', 'BOARD_DIRECTOR', 'MANAGING_DIRECTOR', 'PRINCIPAL', 'ACADEMIC_QA',
  'FINANCE', 'HEAD_OF_DEPARTMENT', 'TEACHER', 'PARENT',
]);
const STUDENT_GENDERS = new Set(['MALE', 'FEMALE']);
const GUARDIAN_RELATIONSHIPS = new Set(['FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING', 'OTHER']);

function buildCsvContent(tpl: { comments: string[]; headers: string[]; sample: string[] }): string {
  const esc = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
  return [...tpl.comments, tpl.headers.join(','), tpl.sample.map(esc).join(',')].join('\r\n');
}

function parseCsvContent(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trimStart().startsWith('#'));
  if (lines.length < 2) return { headers: [], rows: [] };
  const splitLine = (line: string): string[] => {
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
  const headers = splitLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitLine(lines[i]);
    if (vals.every((v) => !v)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = vals[j] ?? ''; });
    rows.push(row);
  }
  return { headers, rows };
}

function requiredHeaders(entity: string): string[] {
  return entity === 'student'
    ? ['first_name', 'last_name', 'date_of_birth', 'gender', 'class_name', 'guardian_first_name', 'guardian_phone']
    : ['first_name', 'last_name', 'email', 'role'];
}

function upperLastNamePassword(row: Record<string, string>): string {
  return (row.last_name || row.lastName || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function validateCsvRows(entity: string, headers: string[], rows: Record<string, string>[]): string[] {
  const errors: string[] = [];
  if (rows.length > 500) errors.push('CSV limit is 500 rows.');
  for (const header of requiredHeaders(entity)) {
    if (!headers.includes(header)) errors.push(`Missing required column: ${header}`);
  }
  const seenEmails = new Set<string>();
  const seenRegistrationNumbers = new Set<string>();
  rows.forEach((row, index) => {
    const line = index + 2;
    for (const header of requiredHeaders(entity)) {
      if (!String(row[header] ?? '').trim()) errors.push(`Row ${line}: ${header} is required.`);
    }
    if (!upperLastNamePassword(row)) {
      errors.push(`Row ${line}: last_name must contain at least one letter or number for the account password.`);
    }
    if (entity === 'student') {
      if (row.date_of_birth && !isIsoDate(row.date_of_birth)) errors.push(`Row ${line}: date_of_birth must be YYYY-MM-DD.`);
      if (row.admission_date && !isIsoDate(row.admission_date)) errors.push(`Row ${line}: admission_date must be YYYY-MM-DD.`);
      if (row.gender && !STUDENT_GENDERS.has(row.gender.toUpperCase())) errors.push(`Row ${line}: gender must be MALE or FEMALE.`);
      if (row.guardian_relationship && !GUARDIAN_RELATIONSHIPS.has(row.guardian_relationship.toUpperCase())) {
        errors.push(`Row ${line}: guardian_relationship is invalid.`);
      }
    } else {
      const role = String(row.role ?? '').toUpperCase();
      if (role && !STAFF_ROLES.has(role)) errors.push(`Row ${line}: role is invalid.`);
      const email = String(row.email ?? '').trim().toLowerCase();
      if (email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`Row ${line}: email is invalid.`);
        if (seenEmails.has(email)) errors.push(`Row ${line}: duplicate email in CSV.`);
        seenEmails.add(email);
      }
      const registrationNumber = String(row.registration_number ?? '').trim().toUpperCase();
      if (registrationNumber) {
        if (seenRegistrationNumbers.has(registrationNumber)) errors.push(`Row ${line}: duplicate registration_number in CSV.`);
        seenRegistrationNumbers.add(registrationNumber);
      }
    }
  });
  return errors;
}

async function loadImportLookup(): Promise<ImportLookup> {
  const [classesResponse, yearsResponse] = await Promise.all([
    api.get('/students/classes'),
    api.get('/students/academic-years'),
  ]);
  const classesPayload = classesResponse.data?.data ?? classesResponse.data;
  const yearsPayload = yearsResponse.data?.data ?? yearsResponse.data;
  const classes = Array.isArray(classesPayload) ? classesPayload : classesPayload?.items ?? classesPayload?.classes ?? [];
  const academicYears = Array.isArray(yearsPayload) ? yearsPayload : yearsPayload?.items ?? yearsPayload?.academicYears ?? yearsPayload?.years ?? [];
  return { classes, academicYears };
}

function findByName<T extends { name?: string }>(items: T[], name: string): T | undefined {
  return items.find((item) => String(item.name ?? '').trim().toLowerCase() === name.trim().toLowerCase());
}

async function importStaffUsers(rows: Record<string, string>[]) {
  const created = [];
  for (const row of rows) {
    const user = await api.post('/auth/users', {
      firstName: row.first_name.trim(),
      lastName: row.last_name.trim(),
      email: row.email.trim(),
      phoneNumber: row.phone_number?.trim() || undefined,
      role: row.role.trim().toUpperCase(),
      department: row.department?.trim() || undefined,
      registrationNumber: row.registration_number?.trim() || undefined,
      password: upperLastNamePassword(row),
      isActive: true,
    }).then((r) => r.data?.data ?? r.data);
    created.push(user);
  }
  return created;
}

async function importStudents(rows: Record<string, string>[]) {
  const lookup = await loadImportLookup();
  const currentYear = lookup.academicYears.find((year) => Boolean(year.isCurrent)) ?? lookup.academicYears[0];
  if (!currentYear) {
    throw new Error('No academic year exists. Create an academic year before importing students.');
  }

  const resolvedRows = rows.map((row, index) => {
    const line = index + 2;
    const cls = findByName(lookup.classes, row.class_name);
    if (!cls) throw new Error(`Row ${line}: class_name "${row.class_name}" does not match an existing class.`);
    const academicYear = row.academic_year?.trim()
      ? findByName(lookup.academicYears, row.academic_year)
      : currentYear;
    if (!academicYear) throw new Error(`Row ${line}: academic_year "${row.academic_year}" does not match an existing year.`);
    return { row, cls, academicYear };
  });

  const created = [];
  for (const { row, cls, academicYear } of resolvedRows) {
    const authUser = await api.post('/auth/users', {
      firstName: row.first_name.trim(),
      lastName: row.last_name.trim(),
      role: 'STUDENT',
      password: upperLastNamePassword(row),
      isActive: true,
    }).then((r) => r.data?.data ?? r.data);

    const student = await api.post('/students', {
      authUserId: authUser.id,
      firstName: row.first_name.trim(),
      middleName: row.middle_name?.trim() || undefined,
      lastName: row.last_name.trim(),
      dateOfBirth: row.date_of_birth,
      gender: row.gender.trim().toUpperCase(),
      nationality: row.nationality?.trim() || 'Tanzanian',
      admissionDate: row.admission_date?.trim() || new Date().toISOString().slice(0, 10),
      classId: cls.id,
      academicYearId: academicYear.id,
      guardians: [{
        firstName: row.guardian_first_name.trim(),
        lastName: row.guardian_last_name?.trim() || row.last_name.trim(),
        relationship: (row.guardian_relationship?.trim() || 'GUARDIAN').toUpperCase(),
        phoneNumber: row.guardian_phone.trim(),
        email: row.guardian_email?.trim() || undefined,
        isPrimary: true,
      }],
    }).then((r) => r.data?.data ?? r.data);

    if (student?.registrationNumber) {
      await api.patch(`/auth/users/${authUser.id}`, { registrationNumber: student.registrationNumber });
    }
    created.push({ user: authUser, student });
  }
  return created;
}

export function CsvImportZone({ entity }: { entity: string }) {
  const qc = useQueryClient();
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<CsvPreviewState | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const tpl = CSV_TEMPLATES[entity] ?? CSV_TEMPLATES['staff user'];

  function handleDownload() {
    const blob = new Blob([buildCsvContent(tpl)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entity.replace(/\s+/g, '_')}_import_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  function handleFile(file: File) {
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCsvContent(e.target?.result as string);
      if (!headers.length || !rows.length) {
        setResult({ ok: false, message: 'No data rows found. Check the file format.' });
        return;
      }
      const errors = validateCsvRows(entity, headers, rows);
      if (errors.length) {
        setPreview(null);
        setResult({ ok: false, message: errors.slice(0, 6).join(' ') + (errors.length > 6 ? ` ${errors.length - 6} more error(s).` : '') });
        return;
      }
      setPreview({ headers, previewRows: rows.slice(0, 3), allRows: rows });
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    setResult(null);
    try {
      const errors = validateCsvRows(entity, preview.headers, preview.allRows);
      if (errors.length) {
        setResult({ ok: false, message: errors.slice(0, 6).join(' ') + (errors.length > 6 ? ` ${errors.length - 6} more error(s).` : '') });
        return;
      }
      if (entity === 'student') {
        await importStudents(preview.allRows);
      } else {
        await importStaffUsers(preview.allRows);
      }
      const count = preview.allRows.length;
      setResult({ ok: true, message: `Successfully imported ${count} ${entity}${count !== 1 ? 's' : ''}.` });
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      if (entity === 'student') {
        qc.invalidateQueries({ queryKey: [...adminKeys.all, 'students'] });
      } else {
        qc.invalidateQueries({ queryKey: adminKeys.users() });
      }
    } catch (err: unknown) {
      const apiData =
        err && typeof err === 'object' && 'response' in err
          ? ((err as Record<string, unknown>).response as Record<string, unknown> | undefined)?.data
          : null;
      const message =
        apiData && typeof apiData === 'object' && 'message' in (apiData as Record<string, unknown>)
          ? String((apiData as Record<string, unknown>).message)
          : err instanceof Error
          ? err.message
          : 'Import failed. Check the file format and try again.';
      setResult({ ok: false, message });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
          dragging
            ? 'border-[#4338CA] bg-indigo-50'
            : 'border-slate-200 bg-slate-50/60 hover:border-[#4338CA]/40 hover:bg-indigo-50/20'
        }`}
      >
        <Upload className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 text-sm font-black text-slate-700">
          Drop {entity} CSV here for bulk import
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-400">
          Up to 500 rows · all fields validated before commit
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Button
            variant="secondary"
            className="rounded-xl py-2 text-xs"
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          >
            <Download className="h-3.5 w-3.5" /> Download Template
          </Button>
          <Button
            className="rounded-xl bg-[#4338CA] py-2 text-xs"
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
          >
            <Upload className="h-3.5 w-3.5" /> Choose CSV File
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {preview && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
            <div>
              <p className="font-display font-black text-slate-950">Preview</p>
              <p className="text-xs font-semibold text-slate-500">
                {preview.allRows.length} row{preview.allRows.length !== 1 ? 's' : ''} detected
                {preview.allRows.length > 3 ? ' · showing first 3' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="rounded-xl py-1.5 text-xs"
                onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
              >
                Clear
              </Button>
              <Button
                className="rounded-xl bg-[#4338CA] py-1.5 text-xs"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? 'Importing…' : `Import ${preview.allRows.length} Record${preview.allRows.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E1B4B] text-[10px] font-black uppercase tracking-widest text-white">
                <tr>
                  {preview.headers.map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3">{h.replace(/_/g, ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.previewRows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    {preview.headers.map((h) => (
                      <td key={h} className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-700">
                        {row[h] || <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
          result.ok
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-rose-200 bg-rose-50 text-rose-600'
        }`}>
          {result.ok
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <XCircle className="h-4 w-4 shrink-0" />
          }
          {result.message}
        </div>
      )}
    </div>
  );
}

// ─── Assessment type inline editor ───────────────────────────────────────────

export function AssessmentTypeEditor({
  types, onSave, loading = false,
}: {
  types: Array<{ id: string; name: string; code?: string; weight: number; maxScore: number; scope: string; academicYearId?: string; educationStage?: string; classLevel?: string; subjectId?: string }>;
  onSave?: (payload: { rows: Array<{ id: string; name: string; code: string; weightPercentage: number; academicYearId: string; educationStage?: string; classLevel?: number; subjectId?: string; isActive: boolean }>; deactivateIds: string[] }) => void;
  loading?: boolean;
}) {
  const [rows, setRows] = useState(types.map((t) => ({ ...t })));
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  React.useEffect(() => {
    setRows(types.map((t) => ({ ...t })));
    setRemovedIds([]);
  }, [types]);
  const total = rows.reduce((s, r) => s + r.weight, 0);
  const valid = Math.abs(total - 100) < 0.001;

  const update = (i: number, field: string, val: string | number) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: val } : r)));
  const codeFor = (name: string, index: number) =>
    name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || `TYPE_${index + 1}`;
  const save = () => {
    if (!valid || !rows.length) return;
    const missing = rows.find((row) => !row.name.trim() || !row.academicYearId);
    if (missing) return;
    onSave?.({
      deactivateIds: removedIds,
      rows: rows.map((row, index) => ({
        id: row.id,
        name: row.name.trim(),
        code: String(row.code || codeFor(row.name, index)),
        weightPercentage: Number(row.weight),
        academicYearId: String(row.academicYearId),
        educationStage: row.educationStage || undefined,
        classLevel: row.classLevel ? Number(row.classLevel) : undefined,
        subjectId: row.subjectId || undefined,
        isActive: true,
      })),
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
        <p className="font-display font-black text-slate-950">Assessment Weight Distribution</p>
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${valid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
          {valid
            ? <CheckCircle2 className="h-3.5 w-3.5" />
            : <AlertTriangle className="h-3.5 w-3.5" />
          }
          Total: {total}% {valid ? '— valid' : '— must equal 100%'}
        </span>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#1E1B4B] text-[11px] font-black uppercase tracking-widest text-white">
          <tr>
            <th className="px-5 py-3.5 text-left">Name</th>
            <th className="px-5 py-3.5 text-left">Weight %</th>
            <th className="px-5 py-3.5 text-left">Max Score</th>
            <th className="px-5 py-3.5 text-left">Scope</th>
            <th className="px-5 py-3.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={row.id} className="hover:bg-slate-50/80">
              <td className="px-5 py-3">
                <input
                  value={row.name}
                  onChange={(e) => update(i, 'name', e.target.value)}
                  className="h-9 w-full max-w-[180px] rounded-lg border border-slate-200 px-3 font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </td>
              <td className="px-5 py-3">
                <input
                  type="number" min={0} max={100} value={row.weight}
                  onChange={(e) => update(i, 'weight', Number(e.target.value))}
                  className="h-9 w-20 rounded-lg border border-slate-200 px-3 text-right font-black outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </td>
              <td className="px-5 py-3">
                <input
                  type="number" min={0} value={row.maxScore}
                  onChange={(e) => update(i, 'maxScore', Number(e.target.value))}
                  className="h-9 w-20 rounded-lg border border-slate-200 px-3 text-right font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </td>
              <td className="px-5 py-3">
                <select
                  value={row.educationStage || row.scope}
                  onChange={(e) => update(i, 'educationStage', e.target.value)}
                  className="h-9 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 font-semibold outline-none transition focus:border-[#4338CA]"
                >
                  <option value="PRIMARY">Primary</option>
                  <option value="O_LEVEL">O-Level</option>
                  <option value="A_LEVEL">A-Level</option>
                </select>
              </td>
              <td className="px-5 py-3 text-right">
                <button
                  onClick={() => {
                    if (!String(row.id).startsWith('new-')) setRemovedIds((prev) => [...prev, row.id]);
                    setRows((prev) => prev.filter((_, j) => j !== i));
                  }}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-3">
        <Button
          variant="quiet"
          className="rounded-xl py-2 text-xs"
          onClick={() => setRows((prev) => [...prev, {
            id: `new-${Date.now()}`,
            name: 'New Type',
            code: '',
            weight: 0,
            maxScore: 100,
            scope: prev[0]?.scope ?? 'O_LEVEL',
            academicYearId: prev[0]?.academicYearId ?? '',
            educationStage: prev[0]?.educationStage ?? 'O_LEVEL',
            classLevel: prev[0]?.classLevel ?? '',
            subjectId: prev[0]?.subjectId ?? '',
          }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add Type
        </Button>
        <Button disabled={!valid || !rows.length} loading={loading} className="ml-auto rounded-xl bg-[#4338CA]" onClick={save}>
          Save Assessment Types
        </Button>
      </div>
    </div>
  );
}

// ─── Grading boundary editor ──────────────────────────────────────────────────

type GradingBoundaryEditorProps = {
  scale: { id: string; name: string; active: boolean; boundaries?: Array<{ label: string; min: number; max: number; points?: number; remark?: string; isPassing?: boolean }> };
  onSave?: (payload: { name: string; boundaries: Array<{ label: string; min: number; max: number; points: number; remark: string; isPassing: boolean }> }) => void;
  onActivate?: () => void;
  loading?: boolean;
};

export function GradingBoundaryEditor(props: GradingBoundaryEditorProps) {
  const { scale, onSave, onActivate, loading = false } = props;
  const [name, setName] = useState(scale.name);
  const [rows, setRows] = useState((scale.boundaries ?? []).map((b) => ({ ...b })));

  React.useEffect(() => {
    setName(scale.name);
    setRows((scale.boundaries ?? []).map((b) => ({ ...b })));
  }, [scale.id, scale.name, scale.boundaries]);

  const update = (i: number, field: string, val: string | number) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: val } : r)));

  const sortedRows = [...rows].sort((a, b) => Number(a.min) - Number(b.min));
  const validationErrors = (() => {
    const errors: string[] = [];
    if (!name.trim()) errors.push('Scale name is required.');
    if (!rows.length) errors.push('Add at least one boundary.');
    rows.forEach((row, index) => {
      if (!String(row.label ?? '').trim()) errors.push(`Row ${index + 1}: grade is required.`);
      if (!Number.isFinite(Number(row.min)) || !Number.isFinite(Number(row.max))) errors.push(`Row ${index + 1}: min and max must be numbers.`);
      if (Number(row.min) > Number(row.max)) errors.push(`Row ${index + 1}: min cannot be greater than max.`);
    });
    if (sortedRows.length && Number(sortedRows[0].min) !== 0) errors.push('Boundaries must start at 0.');
    if (sortedRows.length && Number(sortedRows[sortedRows.length - 1].max) !== 100) errors.push('Boundaries must end at 100.');
    for (let i = 1; i < sortedRows.length; i += 1) {
      const gap = Number(sortedRows[i].min) - Number(sortedRows[i - 1].max);
      if (gap < 0 || gap > 1.0001) errors.push('Boundaries must have no gaps or overlaps.');
    }
    return Array.from(new Set(errors));
  })();
  const boundaryValid = validationErrors.length === 0;

  const save = () => {
    if (!boundaryValid) return;
    onSave?.({
      name: name.trim(),
      boundaries: rows.map((row) => ({
        label: String(row.label).trim().toUpperCase(),
        min: Number(row.min),
        max: Number(row.max),
        points: Number(row.points ?? 0),
        remark: String(row.remark ?? row.label ?? '').trim() || String(row.label).trim().toUpperCase(),
        isPassing: Boolean(row.isPassing ?? Number(row.points ?? 0) > 0),
      })),
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
        <div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 rounded-lg border border-transparent bg-transparent px-2 font-display font-black text-slate-950 outline-none transition focus:border-slate-200 focus:bg-white"
          />
          <p className="text-xs font-semibold text-slate-500">Boundaries must cover 0–100 with no gaps</p>
        </div>
        <div className="flex items-center gap-2">
          {scale.active && <Badge tone="emerald">Active</Badge>}
          {!scale.active && onActivate && (
            <Button variant="secondary" className="rounded-xl py-2 text-xs" loading={loading} onClick={onActivate}>
              Activate
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#1E1B4B] text-[11px] font-black uppercase tracking-widest text-white">
          <tr>
            <th className="px-5 py-3.5 text-left">Grade</th>
            <th className="px-5 py-3.5 text-left">Min %</th>
            <th className="px-5 py-3.5 text-left">Max %</th>
            <th className="px-5 py-3.5 text-left">Points</th>
            <th className="px-5 py-3.5 text-left">Remark</th>
            <th className="px-5 py-3.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/80">
              <td className="px-5 py-3">
                <input
                  value={row.label}
                  onChange={(e) => update(i, 'label', e.target.value)}
                  className="h-9 w-16 rounded-lg border border-slate-200 px-3 text-center font-black outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </td>
              <td className="px-5 py-3">
                <input
                  type="number" min={0} max={100} value={row.min}
                  onChange={(e) => update(i, 'min', Number(e.target.value))}
                  className="h-9 w-20 rounded-lg border border-slate-200 px-3 text-right font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </td>
              <td className="px-5 py-3">
                <input
                  type="number" min={0} max={100} value={row.max}
                  onChange={(e) => update(i, 'max', Number(e.target.value))}
                  className="h-9 w-20 rounded-lg border border-slate-200 px-3 text-right font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </td>
              <td className="px-5 py-3">
                <input
                  type="number" min={0} value={row.points ?? 0}
                  onChange={(e) => update(i, 'points', Number(e.target.value))}
                  className="h-9 w-20 rounded-lg border border-slate-200 px-3 text-right font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </td>
              <td className="px-5 py-3">
                <input
                  value={row.remark ?? ''}
                  onChange={(e) => update(i, 'remark', e.target.value)}
                  className="h-9 w-40 rounded-lg border border-slate-200 px-3 font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </td>
              <td className="px-5 py-3 text-right">
                <button
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3">
        {validationErrors.length > 0 && (
          <p className="mr-auto text-xs font-semibold text-rose-600">{validationErrors[0]}</p>
        )}
        <Button
          variant="quiet"
          className="rounded-xl py-2 text-xs"
          onClick={() => setRows((prev) => [...prev, { label: '', min: 0, max: 0, points: 0, remark: '', isPassing: true }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add Boundary
        </Button>
        <Button disabled={!boundaryValid} loading={loading} className="rounded-xl bg-[#4338CA]" onClick={save}>Save Scale</Button>
      </div>
    </div>
  );
}

// ─── Danger confirmation dialog ───────────────────────────────────────────────

export function DangerActionDialog({ title, entity, confirmation = 'CONFIRM' }: { title: string; entity: string; confirmation?: string }) {
  const [input, setInput] = useState('');
  const valid = typedConfirmationIsValid(input, confirmation);
  return (
    <div className="rounded-2xl border border-[#F43F5E]/30 bg-[#F43F5E]/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#F43F5E]" />
        <div>
          <h3 className="font-display text-xl font-black text-[#9f1239]">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-[#9f1239]/80">
            Affected entity: {entity}. This action is logged in the audit trail.
          </p>
        </div>
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="mt-4 h-11 w-full rounded-xl border border-[#F43F5E]/30 px-4 font-mono font-black outline-none transition focus:border-[#F43F5E]/60"
        placeholder={`Type ${confirmation} to confirm`}
      />
      <textarea
        className="mt-3 h-20 w-full rounded-xl border border-[#F43F5E]/30 p-3 text-sm font-semibold outline-none transition focus:border-[#F43F5E]/60"
        placeholder="Audit note required…"
      />
      <Button disabled={!valid} variant="danger" className="mt-3 w-full rounded-xl">{title}</Button>
    </div>
  );
}

// ─── JSON payload inspector ───────────────────────────────────────────────────

export function JsonInspector({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  const json = JSON.stringify(value, null, 2);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-950">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-black text-white"
        onClick={() => setOpen((v) => !v)}
      >
        <span>JSON payload</span>
        <span className="flex items-center gap-2 text-sky-300">
          <Copy className="h-4 w-4" /> {open ? 'Collapse' : 'Expand'}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <pre className="max-h-72 overflow-auto border-t border-white/10 p-4 text-xs font-semibold text-white/80">{json}</pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Notification template editor ────────────────────────────────────────────

export function NotificationTemplateEditor({ template }: { template: { name: string; channel: string; eventType: string; body: string } }) {
  const [body, setBody] = useState(template.body);
  const valid = handlebarsIsValid(body) && body.trim().length > 0;
  return (
    <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-gutter">
        <AdminFormSection title="Template Identity" subtitle="Channel, event type, and subject configuration">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Name" value={template.name} />
            <Field label="Channel" value={template.channel} readOnly />
            <Field label="Event Type" value={template.eventType} readOnly />
          </div>
        </AdminFormSection>
        <AdminFormSection title="Body" subtitle="Handlebars variables validated before save">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="h-56 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm outline-none transition focus:border-[#4338CA] focus:bg-white"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {['student.name', 'term.name', 'guardian.name', 'finance.balance'].map((chip) => (
              <Badge key={chip} tone="blue">{`{{${chip}}}`}</Badge>
            ))}
          </div>
        </AdminFormSection>
      </div>
      <div className="sticky top-24 h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          {valid
            ? <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
            : <XCircle className="h-5 w-5 text-[#F43F5E]" />
          }
          <h3 className="font-display text-xl font-black text-slate-950">Preview</h3>
        </div>
        <div className="mt-4 min-h-[80px] rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-relaxed text-slate-700">
          {body
            .replaceAll('{{student.name}}',    'Amina')
            .replaceAll('{{term.name}}',       'Term II')
            .replaceAll('{{guardian.name}}',   'Mr. Juma')
            .replaceAll('{{finance.balance}}', 'TZS 400,000')
          }
        </div>
        <Button disabled={!valid} className="mt-4 w-full rounded-xl bg-[#4338CA]">Save Template</Button>
      </div>
    </div>
  );
}

// ─── Quick nav card ───────────────────────────────────────────────────────────

export function AdminQuickCard({ title, detail, to, icon = 'settings' }: { title: string; detail: string; to: string; icon?: 'settings' | 'shield' | 'file' | 'eye' }) {
  const Icon = icon === 'shield' ? Shield : icon === 'file' ? FileText : icon === 'eye' ? Eye : Settings;
  return (
    <NavLink
      to={to}
      className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#4338CA]/40 hover:shadow-layer"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 transition group-hover:bg-indigo-100">
        <Icon className="h-5 w-5 text-[#4338CA]" />
      </div>
      <h3 className="mt-4 font-display text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-1.5 text-sm font-semibold text-slate-500">{detail}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#0EA5E9]">
        Open <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
      </span>
    </NavLink>
  );
}

// ─── Pending integration banner ───────────────────────────────────────────────

export function PendingIntegration({ endpoint: _endpoint }: { endpoint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#F59E0B] bg-[#F59E0B]/10 p-5">
      <div className="flex items-center gap-2 font-black text-[#92400e]">
        <Lock className="h-5 w-5" /> Connection unavailable
      </div>
      <p className="mt-1 text-sm font-semibold text-[#92400e]/80">
        Audit records could not be loaded right now.
      </p>
    </div>
  );
}
