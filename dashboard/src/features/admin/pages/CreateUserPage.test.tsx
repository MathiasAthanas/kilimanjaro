import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../../../lib/auth/authStore';

const mutate = vi.fn();

vi.mock('../api/admin.hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/admin.hooks')>()),
  useDepartments: () => ({ data: [{ name: 'Sciences' }, { name: 'Languages' }, { name: 'Finance' }] }),
  useCreateUserMutation: () => ({ mutate, isPending: false }),
}));

import { CreateUserPage } from './AdminPages';

function renderPage(role: 'ADMIN' | 'SUPER_ADMIN' | 'MANAGER', scope: 'GROUP' | 'SCHOOL') {
  useAuthStore.setState({ session: {
    accessToken: 'test-token',
    user: { id: 'u1', name: 'Admin', email: 'admin@example.test', role, scope, schoolIds: scope === 'GROUP' ? ['*'] : ['school-a'] },
  } });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><CreateUserPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

const optionValues = (select: HTMLElement) => Array.from((select as HTMLSelectElement).options).map((o) => o.value);
const selectByLabel = (label: RegExp) => screen.getByLabelText(label) as HTMLSelectElement;

function fillIdentity() {
  fireEvent.change(screen.getByPlaceholderText('e.g. Amina Rashidi'), { target: { value: 'Amina Rashidi' } });
  fireEvent.change(screen.getByPlaceholderText('name@school.ac.tz'), { target: { value: 'amina@school.test' } });
}

describe('CreateUserPage roles and department', () => {
  beforeEach(() => mutate.mockClear());

  it('starts on "None" and sends no department when none is chosen', () => {
    renderPage('ADMIN', 'GROUP');
    fillIdentity();
    fireEvent.change(selectByLabel(/^Role$/), { target: { value: 'FINANCE' } });

    expect(selectByLabel(/Linked Entity \/ Department/).value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: /Create User/ }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const payload = mutate.mock.calls[0][0];
    expect(payload.role).toBe('FINANCE');
    expect(payload.department).toBeUndefined();
  });

  it('sends the department when one is chosen', () => {
    renderPage('ADMIN', 'GROUP');
    fillIdentity();
    fireEvent.change(selectByLabel(/Linked Entity \/ Department/), { target: { value: 'Sciences' } });
    fireEvent.click(screen.getByRole('button', { name: /Create User/ }));

    expect(mutate.mock.calls[0][0]).toMatchObject({ role: 'TEACHER', department: 'Sciences' });
  });

  it('requires a department for a Head of Department', () => {
    renderPage('ADMIN', 'GROUP');
    fillIdentity();
    fireEvent.change(selectByLabel(/^Role$/), { target: { value: 'HEAD_OF_DEPARTMENT' } });

    expect(screen.getByLabelText(/Department \(required\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Create User/ }));
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Department \(required\)/), { target: { value: 'Languages' } });
    fireEvent.click(screen.getByRole('button', { name: /Create User/ }));
    expect(mutate.mock.calls[0][0]).toMatchObject({ role: 'HEAD_OF_DEPARTMENT', department: 'Languages' });
  });

  it('offers Manager and Head of Finance to a group administrator and hides the department for them', () => {
    renderPage('ADMIN', 'GROUP');
    const roles = optionValues(selectByLabel(/^Role$/));
    expect(roles).toEqual(expect.arrayContaining(['MANAGER', 'HEAD_OF_FINANCE']));

    fillIdentity();
    fireEvent.change(selectByLabel(/^Role$/), { target: { value: 'MANAGER' } });
    expect(screen.queryByLabelText(/Linked Entity \/ Department/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Create User/ }));
    expect(mutate.mock.calls[0][0]).toMatchObject({ role: 'MANAGER', department: undefined });
  });

  it.each([
    ['school-scoped admin', 'ADMIN', 'SCHOOL'],
    ['group manager', 'MANAGER', 'GROUP'],
  ] as const)('does not offer group-wide roles to a %s', (_name, role, scope) => {
    renderPage(role, scope);
    const roles = optionValues(selectByLabel(/^Role$/));
    expect(roles).not.toContain('MANAGER');
    expect(roles).not.toContain('HEAD_OF_FINANCE');
  });
});
