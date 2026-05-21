import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { PasswordField } from '../../components/forms/PasswordField';
import { TextField } from '../../components/forms/TextField';
import { completePasswordReset } from './api';
import { resetPasswordSchema, type ResetPasswordForm } from './schemas';

export function ResetPasswordPage() {
  const [done, setDone] = useState(false);
  const form = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { email: '', token: '', password: '', confirmPassword: '' } });
  const password = form.watch('password');
  const strength = Math.min(100, password.length * 12);

  async function onSubmit(values: ResetPasswordForm) {
    await completePasswordReset({ email: values.email, token: values.token, password: values.password });
    setDone(true);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ks-paper p-6">
      <Card className="w-full max-w-xl p-8">
        {done ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-ks-emerald" />
            <h1 className="mt-4 font-display text-3xl font-bold text-ks-navy">Password updated</h1>
            <p className="mt-2 text-sm text-ks-muted">You can now sign in with your new password.</p>
            <Link to="/login"><Button className="mt-6">Go to login</Button></Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl font-bold text-ks-navy">Create New Password</h1>
            <p className="mt-2 text-sm text-ks-muted">Enter the verification code sent to your registered email.</p>
            <form className="mt-8 space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
              <TextField label="Email" error={form.formState.errors.email?.message} {...form.register('email')} />
              <TextField label="OTP / Token" error={form.formState.errors.token?.message} {...form.register('token')} />
              <PasswordField label="New Password" error={form.formState.errors.password?.message} {...form.register('password')} />
              <div>
                <div className="mb-2 flex justify-between text-xs font-bold text-ks-muted"><span>Password Strength</span><span>{strength}%</span></div>
                <div className="h-2 rounded-full bg-ks-mist"><div className="h-full rounded-full bg-ks-emerald" style={{ width: `${strength}%` }} /></div>
              </div>
              <PasswordField label="Confirm New Password" error={form.formState.errors.confirmPassword?.message} {...form.register('confirmPassword')} />
              <Button className="w-full" loading={form.formState.isSubmitting}>Update Password</Button>
            </form>
          </>
        )}
      </Card>
    </main>
  );
}
