import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { BULK_USER_HEADERS, buildUsersWorkbook, parseBulkUserSheet, usersToCsv } from './bulkUserEditSpreadsheet';

const user = {
  id: 'user-1',
  name: 'Asha Teacher',
  firstName: 'Asha',
  lastName: 'Teacher',
  email: 'asha@example.test',
  registrationNumber: null,
  phoneNumber: '+255700000001',
  department: 'Science',
  role: 'TEACHER',
  status: 'ACTIVE' as const,
  linked: 'Science',
  lastLogin: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-10-29T08:00:00.000Z',
  schoolIds: ['school-2', 'school-1'],
};

describe('bulk user edit spreadsheet', () => {
  it('exports stable identifiers and all editable fields to Excel', () => {
    const workbook = buildUsersWorkbook([user]);
    expect(workbook.SheetNames).toEqual(['Users', 'Instructions']);
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets.Users);
    expect(rows[0]).toMatchObject({
      user_id: 'user-1',
      updated_at: '2026-10-29T08:00:00.000Z',
      school_ids: 'school-1,school-2',
      role: 'TEACHER',
      first_name: 'Asha',
      status: 'ACTIVE',
    });
  });

  it('round-trips an edited worksheet into the backend contract', () => {
    const workbook = buildUsersWorkbook([user]);
    XLSX.utils.sheet_add_aoa(workbook.Sheets.Users, [['Asha Updated']], { origin: 'E2' });
    const rows = parseBulkUserSheet(workbook);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: 'user-1', firstName: 'Asha Updated', role: 'TEACHER' });
  });

  it('rejects files missing identity protection columns', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['first_name'], ['Asha']]), 'Users');
    expect(() => parseBulkUserSheet(workbook)).toThrow(`Missing required columns: ${BULK_USER_HEADERS.filter((header) => header !== 'first_name').join(', ')}`);
  });

  it('exports CSV with a UTF-8 BOM for Excel compatibility', () => {
    const csv = usersToCsv([user]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('user_id,updated_at,school_ids,role');
  });
});
