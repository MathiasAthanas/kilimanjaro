import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { PasswordField } from '../../components/forms/PasswordField';
import { useAuthStore } from '../../lib/auth/authStore';
import { getDefaultRouteForRole } from '../../lib/auth/permissions';
import { changePassword } from './api';

export function ChangePasswordRequiredPage() {
  const navigate = useNavigate();
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (!session) return;

    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      const nextSession = {
        ...session,
        user: { ...session.user, mustChangePassword: false, requiresPasswordChange: false },
      };
      setSession(nextSession, true);
      navigate(getDefaultRouteForRole(session.user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4">
      <form onSubmit={submit} className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-600">First Login Security</p>
        <h1 className="mt-2 font-display text-3xl font-black text-slate-950">Change your temporary password</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          This account was created with an initial password. Set a private password before accessing the workspace.
        </p>

        <div className="mt-7 space-y-5">
          <PasswordField label="Current temporary password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <PasswordField label="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <PasswordField label="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>

        {error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
        <Button type="submit" className="mt-6 w-full rounded-xl bg-[#4338CA] py-4" loading={saving}>
          Save Password
        </Button>
      </form>
    </main>
  );
}
