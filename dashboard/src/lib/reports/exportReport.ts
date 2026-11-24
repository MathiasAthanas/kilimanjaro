import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import { payloadOf } from '../api/response';

export type ReportFormat = 'PDF' | 'XLSX' | 'CSV';

/** What to ask the analytics service for. Names match its ReportType enum; anything else is refused. */
export type ReportRequest = {
  reportType: string;
  scope?: string;
  /** Class, student or teacher the report is about (see the report's "needs"). */
  scopeId?: string;
  termId?: string;
  academicYearId?: string;
  schoolId?: string;
  format?: ReportFormat;
};

type StoredReport = {
  id: string;
  status: string;
  format?: string;
  fileName?: string;
  error?: string | null;
};

const EXTENSION: Record<ReportFormat, string> = { PDF: 'pdf', XLSX: 'xlsx', CSV: 'csv' };
const MIME: Record<ReportFormat, string> = {
  PDF: 'application/pdf',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  CSV: 'text/csv;charset=utf-8',
};

export const formatLabel = (format: string) => (format === 'XLSX' ? 'Excel' : format);

/** A file name that matches the real format, whatever extension the caller guessed. */
export function withExtension(name: string, format: ReportFormat): string {
  const base = name.replace(/\.(pdf|xlsx|csv)$/i, '');
  return `${base}.${EXTENSION[format]}`;
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Error bodies of a blob request arrive as a Blob; read the server's sentence out of it. */
async function blobError(error: unknown, fallback: string): Promise<Error> {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  if (data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text()) as { message?: string | string[] };
      const message = Array.isArray(body.message) ? body.message.join('. ') : body.message;
      if (message) return new Error(message);
    } catch {
      /* fall through */
    }
  }
  return new Error(errorMessage(error, fallback));
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Polls until the file is ready (fast at first, so small reports feel instant). Rejects with the server's reason on failure. */
export async function waitForReport(reportId: string, timeoutMs = 120_000): Promise<StoredReport> {
  const started = Date.now();
  let wait = 600;
  while (Date.now() - started < timeoutMs) {
    await sleep(wait);
    wait = Math.min(2000, Math.round(wait * 1.5));
    const report = (await api.get(`/analytics/reports/${reportId}`).then(payloadOf)) as StoredReport | null;
    if (report?.status === 'READY') return report;
    if (report?.status === 'FAILED') throw new Error(report.error || 'The report could not be generated.');
  }
  throw new Error('The report is taking longer than expected. Check the Download Center in a moment.');
}

/** Downloads a finished report and saves it under a name that matches its real format (a caller's name wins over the server's). */
export async function downloadReport(reportId: string, preferredName?: string, known?: StoredReport): Promise<string> {
  const report = known ?? ((await api.get(`/analytics/reports/${reportId}`).then(payloadOf)) as StoredReport);
  const rawFormat = String(report?.format ?? 'PDF').toUpperCase();
  const format: ReportFormat = rawFormat === 'XLSX' || rawFormat === 'CSV' ? rawFormat : 'PDF';
  let raw: Blob;
  try {
    raw = await api.get(`/analytics/reports/${reportId}/download`, { responseType: 'blob' }).then((r) => r.data as Blob);
  } catch (error) {
    throw await blobError(error, 'The file could not be downloaded.');
  }
  const blob = raw.type && !raw.type.includes('json') ? raw : new Blob([raw], { type: MIME[format] });
  const fileName = preferredName ? withExtension(preferredName, format) : (report?.fileName ?? `report.${EXTENSION[format]}`);
  saveBlob(blob, fileName);
  return fileName;
}

/** Asks for a report, waits for it and downloads it. Resolves with the saved file name. */
export async function exportReport(request: ReportRequest, preferredName?: string): Promise<string> {
  const body = { scope: 'school', ...request, format: request.format ?? 'PDF' };
  let reportId = '';
  try {
    const created = (await api.post('/analytics/reports/generate', body).then(payloadOf)) as { reportId?: string } | null;
    reportId = String(created?.reportId ?? '');
  } catch (error) {
    throw new Error(errorMessage(error, 'The report could not be started.'));
  }
  if (!reportId) throw new Error('The report could not be started.');
  const report = await waitForReport(reportId);
  return downloadReport(reportId, preferredName, report);
}

/** Base64 file as the finance service sends it: { filename, mimeType, base64 }. */
export function saveBase64File(file: { filename: string; mimeType: string; base64: string }): void {
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  saveBlob(new Blob([bytes], { type: file.mimeType }), file.filename);
}

/** The learner's fee statement (every invoice, payment and balance) as a PDF. */
export async function downloadStudentStatement(studentId: string): Promise<string> {
  try {
    const file = (await api.get(`/finance/reports/student-statement/${studentId}/pdf`).then(payloadOf)) as { filename: string; mimeType: string; base64: string };
    saveBase64File(file);
    return file.filename;
  } catch (error) {
    throw new Error(errorMessage(error, 'The statement could not be created.'));
  }
}
