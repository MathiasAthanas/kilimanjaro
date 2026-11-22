import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AwaitingPlacementPanel } from './AwaitingPlacementPanel';

vi.mock('../api/boarding.hooks', () => ({
  useBoardingAwaiting: () => ({
    data: {
      total: 2,
      students: [
        { id: 'boy-1', firstName: 'First', lastName: 'Boy', registrationNumber: 'B1', gender: 'MALE', className: 'Form 1' },
        { id: 'girl-1', firstName: 'First', lastName: 'Girl', registrationNumber: 'G1', gender: 'FEMALE', className: 'Form 1' },
      ],
      dormitories: [
        { id: 'boys', name: 'Boys House', code: 'B', gender: 'MALE', availableBeds: 2 },
        { id: 'girls', name: 'Girls House', code: 'G', gender: 'FEMALE', availableBeds: 2 },
      ],
    },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useAssignDormitoryStudent: () => ({ mutateAsync: vi.fn() }),
  useDormitory: () => ({ data: { beds: [{ id: 'bed-1', label: 'B001', status: 'AVAILABLE' }] }, isLoading: false }),
}));

describe('gender-scoped dormitory placement', () => {
  it('only shows students matching the selected dormitory', async () => {
    render(<AwaitingPlacementPanel />);
    await waitFor(() => expect(screen.getByText('First Boy')).toBeTruthy());
    expect(screen.queryByText('First Girl')).toBeNull();
    fireEvent.change(screen.getByLabelText('Place into'), { target: { value: 'girls' } });
    expect(screen.getByText('First Girl')).toBeTruthy();
    expect(screen.queryByText('First Boy')).toBeNull();
  });
});
