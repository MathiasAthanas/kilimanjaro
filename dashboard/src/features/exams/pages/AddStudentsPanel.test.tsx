import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AddStudentsPanel, type AddableStudent } from './AddStudentsPanel';

const student = (over: Partial<AddableStudent>): AddableStudent => ({
  studentId: 's1', registrationNumber: 'ADM1', name: 'Amina Test', reason: 'EXEMPT', canAdd: true, blockedBy: null,
  existing: { score: 0, isAbsent: true, notSat: true }, ...over,
});

describe('AddStudentsPanel', () => {
  it('explains in plain words why each student is not on the list', () => {
    render(<AddStudentsPanel onAdd={vi.fn()} onClose={vi.fn()} students={[
      student({}),
      student({ studentId: 's2', registrationNumber: 'ADM2', name: 'Baraka Test', reason: 'NOT_TAKING', existing: null }),
    ]} />);
    expect(screen.getByText(/Recorded as Not sat and exempt/)).toBeTruthy();
    expect(screen.getByText(/Not registered for this subject/)).toBeTruthy();
  });

  it('adds only the ticked students', () => {
    const onAdd = vi.fn();
    render(<AddStudentsPanel onAdd={onAdd} onClose={vi.fn()} students={[student({}), student({ studentId: 's2', registrationNumber: 'ADM2', name: 'Baraka Test' })]} />);
    const add = screen.getByRole('button', { name: /Add\s*selected/ }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Add Baraka Test'));
    fireEvent.click(screen.getByRole('button', { name: /Add 1 selected/ }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].map((s: AddableStudent) => s.studentId)).toEqual(['s2']);
  });

  it('select all ticks everyone who can be added, and skips blocked students', () => {
    const onAdd = vi.fn();
    render(<AddStudentsPanel onAdd={onAdd} onClose={vi.fn()} students={[
      student({}),
      student({ studentId: 's2', registrationNumber: 'ADM2', name: 'Baraka Test' }),
      student({ studentId: 's3', registrationNumber: 'ADM3', name: 'Chausiku Test', reason: 'NOT_TAKING', canAdd: false, blockedBy: 'ADMIN_ONLY' }),
    ]} />);
    expect(screen.getByText(/Ask an administrator to add this student/)).toBeTruthy();
    expect((screen.getByLabelText('Add Chausiku Test') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/Select all/));
    fireEvent.click(screen.getByRole('button', { name: /Add 2 selected/ }));
    expect(onAdd.mock.calls[0][0].map((s: AddableStudent) => s.studentId)).toEqual(['s1', 's2']);
  });

  it('finds a student by name when the list is long', () => {
    const many = Array.from({ length: 8 }, (_, i) => student({ studentId: `s${i}`, registrationNumber: `ADM${i}`, name: `Student ${i}` }));
    render(<AddStudentsPanel onAdd={vi.fn()} onClose={vi.fn()} students={many} />);
    fireEvent.change(screen.getByLabelText('Search students'), { target: { value: 'student 5' } });
    expect(screen.queryByLabelText('Add Student 4')).toBeNull();
    expect(screen.getByLabelText('Add Student 5')).toBeTruthy();
  });
});
