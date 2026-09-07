import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { UserAccountForm } from './UserAccountForm';
import { api } from '../../../lib/api/client';
import { useAuthStore } from '../../../lib/auth/authStore';
vi.mock('../../../lib/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const user = { id:'u1', firstName:'Asha', lastName:'Mushi', email:'asha@test.local', phoneNumber:'+255712345678', department:'Science', schoolId:'school-a', roles:['TEACHER','HEAD_OF_DEPARTMENT'], primaryRole:'HEAD_OF_DEPARTMENT', role:'HEAD_OF_DEPARTMENT' };
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions:{queries:{retry:false}} })}><MemoryRouter><UserAccountForm userId="u1" /></MemoryRouter></QueryClientProvider>); }
beforeEach(() => {
 vi.clearAllMocks();
 useAuthStore.setState({session:{accessToken:'test',user:{id:'admin',name:'Admin',email:'admin@test.local',role:'ADMIN',roles:['ADMIN'],schoolId:'school-a'}}});
 vi.mocked(api.get).mockImplementation(async path => ({data: path.endsWith('/schools') ? {data:[{id:'school-a',name:'School A'}]} : {data:user}}) as any);
 vi.mocked(api.patch).mockResolvedValue({data:{data:user}});
 vi.spyOn(window,'confirm').mockReturnValue(true);
});
describe('user account editing', () => {
 it('initializes editable email and exact profile fields; school is fixed', async () => {
  mount();
  const email=await screen.findByLabelText('Email');expect(email).toHaveValue(user.email);expect(email).not.toHaveAttribute('readonly');
  expect(screen.getByLabelText('Phone number')).toHaveValue(user.phoneNumber);
  expect(screen.getByLabelText('School')).toBeDisabled();
  fireEvent.change(email,{target:{value:'updated@test.local'}});fireEvent.click(screen.getByRole('button',{name:'Save user'}));
  await waitFor(()=>expect(api.patch).toHaveBeenCalledWith('/auth/users/u1',expect.objectContaining({firstName:'Asha',lastName:'Mushi',email:'updated@test.local',phoneNumber:user.phoneNumber,department:'Science',schoolId:'school-a',roles:user.roles,primaryRole:'HEAD_OF_DEPARTMENT'})));
  const payload=vi.mocked(api.patch).mock.calls[0][1] as Record<string,unknown>;expect(payload).not.toHaveProperty('name');expect(payload).not.toHaveProperty('phone');expect(payload).not.toHaveProperty('linked');
 });
 it('cannot save after deselecting the primary role', async () => {
  mount();await screen.findByLabelText('Email');fireEvent.click(screen.getByLabelText('HEAD OF DEPARTMENT'));
  expect(screen.getByRole('button',{name:'Save user'})).toBeDisabled();expect(api.patch).not.toHaveBeenCalled();
 });
});

it('shows normalized backend validation messages', async () => {
 vi.mocked(api.patch).mockRejectedValue({ status: 409, message: 'Email or registration number already exists' });
 mount(); await screen.findByLabelText('Email'); fireEvent.click(screen.getByRole('button', { name: 'Save user' }));
 expect(await screen.findByRole('alert')).toHaveTextContent('Email or registration number already exists');
});
