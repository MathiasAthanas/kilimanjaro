import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../lib/auth/authStore';
import { useSchoolStore } from '../../lib/school/schoolStore';
import { ContextTaskBar } from './ContextTaskBar';
import { SchoolContextBar } from './SchoolContextBar';
import { SchoolWorkBar } from './SchoolWorkBar';

vi.mock('../../features/manager/api/manager.hooks', () => ({
  useSchools: () => ({ data: [
    { id: 'school-a', name: 'Kilimanjaro A', code: 'KA', type: 'PRIMARY', gender: 'MIXED' },
    { id: 'school-b', name: 'Kilimanjaro B', code: 'KB', type: 'PRIMARY', gender: 'MIXED' },
  ] }),
}));

function setSession(role: 'ADMIN' | 'MANAGER' | 'ADMISSIONS' | 'SUPER_ADMIN' | 'HEAD_OF_FINANCE', scope: 'GROUP' | 'SCHOOL', schoolIds: string[]) {
  useAuthStore.setState({ session: {
    accessToken: 'test-token',
    user: { id: 'user-1', name: 'Test User', email: 'test@example.test', role, scope, schoolIds },
  } });
}

function LocationPath() {
  const { pathname } = useLocation();
  return <output aria-label="Current route">{pathname}</output>;
}

describe('school and workflow context', () => {
  beforeEach(() => useSchoolStore.setState({ activeSchool: null }));

  it('keeps All Schools available only for a group-scoped session', () => {
    setSession('MANAGER', 'GROUP', []);
    render(<MemoryRouter initialEntries={['/manager/overview']}><SchoolContextBar /></MemoryRouter>);
    expect(screen.getByText('Current scope')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Switch school; current selection All Schools/ }));
    expect(screen.getAllByText('All Schools (Group)').length).toBeGreaterThan(0);
    expect(screen.getByText('Kilimanjaro A')).toBeTruthy();
    expect(screen.getByText('Kilimanjaro B')).toBeTruthy();
  });

  it('limits a multi-school user to assigned schools', () => {
    setSession('ADMIN', 'SCHOOL', ['school-b']);
    render(<MemoryRouter initialEntries={['/admin/students']}><SchoolContextBar /></MemoryRouter>);
    expect(screen.getByText('Current school')).toBeTruthy();
    expect(screen.getByText('Kilimanjaro B')).toBeTruthy();
    expect(screen.queryByText('Kilimanjaro A')).toBeNull();
    expect(screen.queryByText('All Schools (Group)')).toBeNull();
  });

  it('shows authorized people tasks in their current section', () => {
    setSession('ADMISSIONS', 'SCHOOL', ['school-a']);
    render(<MemoryRouter initialEntries={['/admissions/students/enrol']}><ContextTaskBar /></MemoryRouter>);
    expect(screen.getByRole('navigation', { name: 'Admissions Desk tasks' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Students' }).getAttribute('href')).toBe('/admissions/students');
    expect(screen.getByRole('link', { name: 'Import Students' }).getAttribute('href')).toBe('/admissions/students/import');
    expect(screen.getByRole('link', { name: 'Enrol Student' }).getAttribute('aria-current')).toBe('page');
  });

  it('keeps academic setup navigation available to an authorized super admin on deep links', () => {
    setSession('SUPER_ADMIN', 'GROUP', []);
    render(<MemoryRouter initialEntries={['/admin/subjects/subject-1']}><ContextTaskBar /></MemoryRouter>);
    expect(screen.getByRole('navigation', { name: 'Academic Structure tasks' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Teaching Assignments' }).getAttribute('href')).toBe('/admin/academic/class-subjects');
  });

  it('takes Head of Finance from group totals into the selected school finance, not principal', () => {
    setSession('HEAD_OF_FINANCE', 'GROUP', ['school-b']);
    render(<MemoryRouter initialEntries={['/finance-group']}><SchoolContextBar /><LocationPath /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Switch school; current selection All Schools/ }));
    expect(screen.queryByText('Kilimanjaro A')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Kilimanjaro B/ }));
    expect(screen.getByLabelText('Current route').textContent).toBe('/finance/invoices');
    expect(screen.getByText('School drill-down')).toBeTruthy();
  });

  it('shows school finance tasks only inside a selected group-role school', () => {
    setSession('HEAD_OF_FINANCE', 'GROUP', ['school-b']);
    useSchoolStore.getState().setActiveSchool({ id: 'school-b', name: 'Kilimanjaro B', code: 'KB', type: 'PRIMARY', gender: 'MIXED' });
    render(<MemoryRouter initialEntries={['/finance/invoices']}><SchoolWorkBar /></MemoryRouter>);
    expect(screen.getByRole('navigation', { name: 'Kilimanjaro B school workspaces' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Invoices' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'School Overview' })).toBeNull();
  });

  it('returns from a Head of Finance school drill-down to consolidated totals', () => {
    setSession('HEAD_OF_FINANCE', 'GROUP', ['school-b']);
    useSchoolStore.getState().setActiveSchool({ id: 'school-b', name: 'Kilimanjaro B', code: 'KB', type: 'PRIMARY', gender: 'MIXED' });
    render(<MemoryRouter initialEntries={['/finance/invoices']}><SchoolContextBar /><LocationPath /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Back to Group/ }));
    expect(screen.getByLabelText('Current route').textContent).toBe('/finance-group');
    expect(screen.getByText('All Schools (Group)')).toBeTruthy();
  });

  it('keeps a school-scoped section when switching assigned schools', () => {
    setSession('MANAGER', 'GROUP', ['school-a', 'school-b']);
    useSchoolStore.getState().setActiveSchool({ id: 'school-a', name: 'Kilimanjaro A', code: 'KA', type: 'PRIMARY', gender: 'MIXED' });
    render(<MemoryRouter initialEntries={['/admin/users']}><SchoolContextBar /><LocationPath /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Switch school; current selection Kilimanjaro A/ }));
    fireEvent.click(screen.getByRole('button', { name: /Kilimanjaro B/ }));
    expect(screen.getByLabelText('Current route').textContent).toBe('/admin/users');
    expect(useSchoolStore.getState().activeSchool?.id).toBe('school-b');
  });
});
