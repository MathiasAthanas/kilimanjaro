import { describe, expect, it } from 'vitest';
import { canAccessRoute, getDefaultRouteForRole, type UserRole } from '../../lib/auth/permissions';
import { getActiveSection, getSectionsForRole } from './RoleSidebar';

const homes: Record<UserRole, string> = {
  STUDENT: '/app/mobile-guidance', PARENT: '/app/mobile-guidance',
  TEACHER: '/teacher', HOD: '/hod', AQA: '/aqa', FINANCE: '/finance',
  PRINCIPAL: '/principal', ADMIN: '/admin', ADMISSIONS: '/admissions',
  SUPER_ADMIN: '/superadmin', MANAGER: '/manager',
  HEAD_OF_SCHOOL: '/principal', HEAD_OF_FINANCE: '/finance-group',
};

describe('role navigation flow', () => {
  it.each(Object.entries(homes) as [UserRole, string][])('%s keeps its landing route', (role, home) => {
    expect(getDefaultRouteForRole(role)).toBe(home);
  });

  it.each(Object.keys(homes) as UserRole[])('%s only exposes route-authorized sidebar tasks', (role) => {
    const sections = getSectionsForRole(role);
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section.items.length).toBeGreaterThan(0);
      for (const item of section.items) expect(canAccessRoute(role, item.to)).toBe(true);
    }
  });

  it('finds the most specific section on nested people routes', () => {
    const sections = getSectionsForRole('ADMIN');
    expect(getActiveSection(sections, '/admin/users/123/edit')?.title).toBe('Users & Staff');
    expect(getActiveSection(sections, '/admin/students/123')?.title).toBe('Students');
    expect(getActiveSection(sections, '/admin/academic/class-subjects')?.title).toBe('Academic Structure');
    expect(getActiveSection(sections, '/admin/academic/years')?.title).toBe('Academic Structure');
    expect(getActiveSection(sections, '/admin/academic/terms')?.title).toBe('Academic Structure');
  });

  it('keeps the original admin and admissions tasks discoverable', () => {
    const admin = getSectionsForRole('ADMIN').flatMap((section) => section.items.map((item) => item.to));
    expect(admin).toEqual(expect.arrayContaining([
      '/admin/users', '/admin/users/create', '/admin/students', '/admin/students/import',
      '/admin/import', '/admin/academic/setup', '/admin/classes', '/admin/subjects',
      '/admin/departments', '/admin/academic/class-subjects',
    ]));
    const admissions = getSectionsForRole('ADMISSIONS').flatMap((section) => section.items.map((item) => item.to));
    expect(admissions).toEqual(expect.arrayContaining([
      '/admissions', '/admissions/intake', '/admissions/applicants',
      '/admissions/students', '/admissions/students/enrol', '/admissions/students/import',
    ]));
  });

  it('keeps finance ledgers before posting and all reporting controls reachable', () => {
    const sections = getSectionsForRole('FINANCE');
    expect(sections.find((section) => section.title === 'Invoices')?.items.map((item) => item.to)).toEqual([
      '/finance/invoices', '/finance/invoices/generate',
    ]);
    expect(sections.find((section) => section.title === 'Payments & Receipts')?.items.map((item) => item.to)).toEqual([
      '/finance/payments', '/finance/payments/cash', '/finance/payments/bank',
      '/finance/payments/pending', '/finance/receipts',
    ]);
    expect(sections.flatMap((section) => section.items.map((item) => item.to))).toEqual(expect.arrayContaining([
      '/finance/fee-categories', '/finance/fee-structures', '/finance/fee-structures/matrix',
      '/finance/fee-assignments', '/finance/fund-requests', '/finance/expenses', '/finance/store',
      '/finance/assets', '/finance/reports/statement', '/finance/reports/fee-defaulters',
      '/finance/exports', '/finance/audit',
    ]));
  });

  it('keeps principal approvals separate from finance posting', () => {
    const principal = getSectionsForRole('PRINCIPAL').flatMap((section) => section.items.map((item) => item.to));
    expect(principal).toEqual(expect.arrayContaining([
      '/principal/finance', '/principal/finance/approvals', '/principal/finance/fund-approvals',
      '/principal/finance/statement',
    ]));
    expect(principal).not.toContain('/finance/payments/cash');
  });
});
