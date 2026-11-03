import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { WindowPlan } from '../api/examHooks';

const omitAsync = vi.fn();
let plan: WindowPlan;

vi.mock('../api/examHooks', () => ({
  useWindowPlan: () => ({ data: plan, isLoading: false, isError: false, refetch: vi.fn() }),
  useOmitSubject: () => ({ mutateAsync: omitAsync, isPending: false }),
  useRestoreSubject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveStandingRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSyncSubjects: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { WindowPlanPanel } from './ExamWindowPlan';

const subject = (over: Record<string, unknown>) => ({
  classSubjectId: 'cs1', subjectId: 'math', subjectName: 'Mathematics', subjectCode: 'MATH', isOptional: false, combination: null,
  teacherId: 't1', teacherName: 'Daniel Mrema', state: 'INCLUDED', assessmentId: null, assessmentStatus: null, marksEntered: 0,
  exclusion: null, warnings: [], ...over,
});

function draftPlan(): WindowPlan {
  return {
    window: { id: 'w1', name: 'Midterm', status: 'DRAFT', opened: false, scopeType: 'STANDARDS' },
    summary: { classes: 1, subjects: 2, marksSheets: 2, omitted: 0, notAdded: 0, withoutTeacher: 0, teachers: 2 },
    editable: true,
    classes: [{ classId: 'c1', label: 'Standard 4 A', level: 4, stage: 'PRIMARY', studentCount: 14, subjects: [
      subject({}),
      subject({ classSubjectId: 'cs2', subjectId: 'sci', subjectName: 'Science', teacherId: 't2', teacherName: 'Gloria Sanga' }),
    ] as never }],
    subjects: [
      { subjectId: 'math', subjectName: 'Mathematics', classes: 1, included: 1, omitted: 0, notAdded: 0 },
      { subjectId: 'sci', subjectName: 'Science', classes: 1, included: 1, omitted: 0, notAdded: 0 },
    ],
    standingRules: [],
    warnings: [],
  };
}

const view = () => render(<MemoryRouter><WindowPlanPanel windowId="w1" status="DRAFT" entry={{}} /></MemoryRouter>);

describe('WindowPlanPanel', () => {
  it('shows each subject with the teacher responsible before the window opens', () => {
    plan = draftPlan();
    view();
    expect(screen.getByText('Standard 4 A')).toBeTruthy();
    expect(screen.getByText('Daniel Mrema')).toBeTruthy();
    expect(screen.getByText('Gloria Sanga')).toBeTruthy();
    expect(screen.getAllByText('Will be included').length).toBe(2);
  });

  it('needs a reason before a subject can be left out, then sends the choice', async () => {
    plan = draftPlan();
    omitAsync.mockResolvedValue({ sheetsRemoved: 0, marksDiscarded: 0 });
    view();
    fireEvent.click(screen.getAllByText('Leave out…')[1]);
    const go = screen.getByRole('button', { name: /Leave it out/ }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/Practical assessment/), { target: { value: 'Project work' } });
    expect(go.disabled).toBe(false);
    fireEvent.click(go);
    await waitFor(() => expect(omitAsync).toHaveBeenCalledWith({ subjectId: 'sci', classIds: [], reason: 'Project work', applyToAllWindows: false, discardMarks: false }));
  });

  it('asks for confirmation before discarding marks that were already entered', async () => {
    plan = draftPlan();
    omitAsync.mockRejectedValueOnce({ message: '3 mark(s) have already been entered for Science (Standard 4 A: 3). Confirm to discard them, or keep the subject.' });
    view();
    fireEvent.click(screen.getAllByText('Leave out…')[1]);
    fireEvent.change(screen.getByPlaceholderText(/Practical assessment/), { target: { value: 'Project work' } });
    fireEvent.click(screen.getByRole('button', { name: /Leave it out/ }));
    const confirm = await screen.findByRole('button', { name: /discard the marks/ });
    omitAsync.mockResolvedValueOnce({ sheetsRemoved: 1, marksDiscarded: 3 });
    fireEvent.click(confirm);
    await waitFor(() => expect(omitAsync).toHaveBeenLastCalledWith(expect.objectContaining({ subjectId: 'sci', discardMarks: true })));
  });

  it('shows omitted subjects with their reason and a way to put them back', () => {
    plan = draftPlan();
    plan.classes[0].subjects[1] = subject({
      classSubjectId: 'cs2', subjectId: 'sci', subjectName: 'Science', teacherId: 't2', teacherName: 'Gloria Sanga', state: 'OMITTED',
      exclusion: { id: 'x1', source: 'WINDOW', scope: 'CLASS', reason: 'Practical only', createdAt: '', createdByName: 'Admin' },
    }) as never;
    plan.summary.omitted = 1;
    view();
    expect(screen.getAllByText('Left out').length).toBeGreaterThan(1);
    expect(screen.getByText(/Practical only/)).toBeTruthy();
    expect(screen.getByText(/Put back/)).toBeTruthy();
  });

  it('is read-only once results are calculated', () => {
    plan = draftPlan();
    plan.editable = false;
    plan.window.status = 'CLOSED';
    render(<MemoryRouter><WindowPlanPanel windowId="w1" status="CLOSED" entry={{}} /></MemoryRouter>);
    expect(screen.queryByText('Leave out…')).toBeNull();
    expect(screen.getByText(/already calculated/)).toBeTruthy();
  });
});
