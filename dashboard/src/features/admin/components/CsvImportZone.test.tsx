import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CsvImportZone } from './AdminConsole';
import { api } from '../../../lib/api/client';
vi.mock('../../../lib/api/client', () => ({ api: { post: vi.fn() } }));
vi.mock('./UserAccountForm', () => ({ SchoolSelect: ({ onChange }: { onChange: (id: string) => void }) => <button onClick={() => onChange('school-a')}>Select School A</button> }));
const csv = 'first_name,last_name,email,phone_number,department,roles,primary_role\nAsha,Mushi,asha@example.com,+255712345678,Science,TEACHER|HEAD_OF_DEPARTMENT,HEAD_OF_DEPARTMENT';
async function mount() {
 const view = render(<QueryClientProvider client={new QueryClient()}><CsvImportZone entity="staff user" /></QueryClientProvider>);
 fireEvent.click(screen.getByText('Select School A'));
 fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [new File([csv], 'staff.csv', { type: 'text/csv' })] } });
 await screen.findByRole('button', { name: 'Validate import' });
}
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(window, 'confirm').mockReturnValue(true); });
it('validates once then commits the whole batch with the selected school', async () => {
 vi.mocked(api.post).mockResolvedValue({ data: { valid: true, errors: [], createdCount: 1, batchId: 'batch-1' } });
 await mount(); fireEvent.click(screen.getByRole('button', { name: 'Validate import' }));
 await screen.findByRole('button', { name: 'Confirm import of 1 records' });
 expect(api.post).toHaveBeenCalledTimes(1);
 expect(api.post).toHaveBeenLastCalledWith('/auth/users/bulk', expect.objectContaining({ schoolId: 'school-a', mode: 'VALIDATE_ONLY', rows: [expect.objectContaining({ roles: ['TEACHER', 'HEAD_OF_DEPARTMENT'] })] }), expect.anything());
 fireEvent.click(screen.getByRole('button', { name: 'Confirm import of 1 records' }));
 await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
 expect(vi.mocked(api.post).mock.calls[1][1]).toMatchObject({ mode: 'COMMIT', schoolId: 'school-a' });
 await screen.findByText(/Batch: batch-1/);
});
it('shows server row errors and never starts per-user creation', async () => {
 vi.mocked(api.post).mockResolvedValue({ data: { valid: false, errors: [{ rowNumber: 2, message: 'Duplicate email' }] } });
 await mount(); fireEvent.click(screen.getByRole('button', { name: 'Validate import' }));
 await screen.findByText(/Row 2: Duplicate email/);
 expect(api.post).toHaveBeenCalledTimes(1);
 expect(screen.queryByRole('button', { name: /Confirm import/ })).not.toBeInTheDocument();
});
