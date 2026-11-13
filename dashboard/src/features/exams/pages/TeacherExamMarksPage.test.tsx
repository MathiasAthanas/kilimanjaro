import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const uploadAsync = vi.fn();
let template: Record<string, unknown>;

vi.mock('../api/examHooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/examHooks')>()),
  useMarksTemplate: () => ({ data: template, isLoading: false, isError: false, refetch: vi.fn() }),
  useExamReference: () => ({ data: { classes: [], years: [], terms: [] } }),
  useUploadMarks: () => ({ mutateAsync: uploadAsync, isPending: false }),
  useSubmitAssessment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateEditRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDecideEditRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEditRequests: () => ({ data: [] }),
}));

import { TeacherExamMarksPage } from './ExamPages';

function setTemplate(windowStatus = 'REOPENED') {
  template = {
    assessment: { id: 'a1', subjectName: 'French', classId: 'c1', maxScore: 100, status: 'OPEN', examWindow: { id: 'w1', name: 'Annual', status: windowStatus } },
    rosterSize: 1,
    rows: [{ registrationNumber: 'ADM1', studentId: 's1', studentName: 'Amina Test', score: 70, isAbsent: false, notSat: false, note: '' }],
    addable: [
      { studentId: 's2', registrationNumber: 'ADM2', name: 'Baraka Test', reason: 'EXEMPT', canAdd: true, blockedBy: null, existing: { score: 0, isAbsent: true, notSat: true } },
    ],
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/teacher/exams/marks/a1']}>
      <Routes><Route path="/teacher/exams/marks/:assessmentId" element={<TeacherExamMarksPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('TeacherExamMarksPage: add students', () => {
  beforeEach(() => { uploadAsync.mockReset(); uploadAsync.mockResolvedValue({ message: 'saved', errors: [] }); });

  it('lets a teacher bring in an exempt student, enter a score and save it with the add flag', async () => {
    setTemplate();
    renderPage();
    expect(screen.queryByText('Baraka Test')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Add students \(1\)/ }));
    fireEvent.click(screen.getByLabelText('Add Baraka Test'));
    fireEvent.click(screen.getByRole('button', { name: /Add 1 selected/ }));

    // The student is now in the grid, marked Added, waiting for a score.
    expect(screen.getByText('Baraka Test')).toBeTruthy();
    expect(screen.getByText('Added')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Score for Baraka Test'), { target: { value: '58' } });
    fireEvent.click(screen.getByRole('button', { name: /Save marks/ }));

    await waitFor(() => expect(uploadAsync).toHaveBeenCalled());
    const rows = uploadAsync.mock.calls[0][0].rows as any[];
    expect(rows.find((r) => r.studentId === 's2')).toMatchObject({ add: true, score: 58, registrationNumber: 'ADM2' });
    // The student already on the list is saved as before, without the add flag.
    expect(rows.find((r) => r.registrationNumber === 'ADM1').add).toBeUndefined();
  });

  it('an added student can be removed again before saving', () => {
    setTemplate();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Add students \(1\)/ }));
    fireEvent.click(screen.getByLabelText('Add Baraka Test'));
    fireEvent.click(screen.getByRole('button', { name: /Add 1 selected/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText('Baraka Test')).toBeNull();
    expect(screen.getByRole('button', { name: /Add students \(1\)/ })).toBeTruthy();
  });

  it('does not offer to add students once the window is closed', () => {
    setTemplate('CLOSED');
    renderPage();
    expect(screen.queryByRole('button', { name: /Add students/ })).toBeNull();
  });
});
