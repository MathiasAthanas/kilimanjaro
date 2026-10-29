import * as XLSX from 'xlsx';
import type { AdminUserRow } from '../api/admin.hooks';

export const BULK_USER_HEADERS = [
  'user_id',
  'updated_at',
  'school_ids',
  'role',
  'first_name',
  'last_name',
  'email',
  'registration_number',
  'phone_number',
  'department',
  'status',
] as const;

export type BulkUserUploadRow = {
  userId: string;
  updatedAt: string;
  schoolIds: string;
  role: string;
  firstName: string;
  lastName: string;
  email: string | null;
  registrationNumber: string | null;
  phoneNumber: string | null;
  department: string | null;
  status: 'ACTIVE' | 'INACTIVE';
};

function text(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

export function usersToSheetRows(users: AdminUserRow[]): Array<Record<string, string>> {
  return users.map((user) => ({
    user_id: user.id,
    updated_at: text(user.updatedAt),
    school_ids: (user.schoolIds ?? []).slice().sort().join(','),
    role: user.role,
    first_name: text(user.firstName),
    last_name: text(user.lastName),
    email: text(user.email),
    registration_number: text(user.registrationNumber),
    phone_number: text(user.phoneNumber),
    department: text(user.department),
    status: user.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  }));
}

export function buildUsersWorkbook(users: AdminUserRow[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const rows = usersToSheetRows(users);
  const userSheet = XLSX.utils.json_to_sheet(rows, { header: [...BULK_USER_HEADERS] });
  userSheet['!cols'] = BULK_USER_HEADERS.map((header) => ({
    wch: ['user_id', 'updated_at', 'school_ids'].includes(header) ? 38 : header === 'email' ? 30 : 22,
  }));
  XLSX.utils.book_append_sheet(workbook, userSheet, 'Users');
  const instructions = [
    ['Bulk user edit instructions'],
    ['1. Edit only first_name, last_name, email, registration_number, phone_number, department, and status.'],
    ['2. Do not change user_id, updated_at, school_ids, or role. They protect account identity and school access.'],
    ['3. status accepts ACTIVE or INACTIVE. Empty cells clear optional values.'],
    ['4. Upload this file using Bulk Edit Users. You will review every change before anything is saved.'],
    ['5. Existing passwords are never exported. Password resets are selected during preview.'],
  ];
  const instructionSheet = XLSX.utils.aoa_to_sheet(instructions);
  instructionSheet['!cols'] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions');
  return workbook;
}

export function usersToCsv(users: AdminUserRow[]): string {
  const sheet = XLSX.utils.json_to_sheet(usersToSheetRows(users), { header: [...BULK_USER_HEADERS] });
  return `\uFEFF${XLSX.utils.sheet_to_csv(sheet)}`;
}

export function parseBulkUserSheet(workbook: XLSX.WorkBook): BulkUserUploadRow[] {
  const sheetName = workbook.SheetNames.includes('Users') ? 'Users' : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error('The workbook does not contain a user sheet.');
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: false });
  if (!matrix.length) throw new Error('The uploaded file is empty.');
  const headers = matrix[0].map((value) => text(value).toLowerCase());
  const missing = BULK_USER_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}.`);
  if (matrix.length - 1 > 2000) throw new Error('A bulk edit can contain at most 2,000 users.');
  const index = Object.fromEntries(headers.map((header, column) => [header, column]));
  return matrix.slice(1).filter((row) => row.some((value) => text(value))).map((row, rowIndex) => {
    const value = (header: typeof BULK_USER_HEADERS[number]) => text(row[index[header]]);
    const status = value('status').toUpperCase();
    if (status !== 'ACTIVE' && status !== 'INACTIVE') {
      throw new Error(`Row ${rowIndex + 2}: status must be ACTIVE or INACTIVE.`);
    }
    return {
      userId: value('user_id'),
      updatedAt: value('updated_at'),
      schoolIds: value('school_ids'),
      role: value('role'),
      firstName: value('first_name'),
      lastName: value('last_name'),
      email: value('email') || null,
      registrationNumber: value('registration_number') || null,
      phoneNumber: value('phone_number') || null,
      department: value('department') || null,
      status,
    };
  });
}

export async function readBulkUserFile(file: File): Promise<BulkUserUploadRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const rows = parseBulkUserSheet(workbook);
  if (!rows.length) throw new Error('The uploaded file has no user rows.');
  return rows;
}
