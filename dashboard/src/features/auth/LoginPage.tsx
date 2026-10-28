import { zodResolver } from '@hookform/resolvers/zod';
import { LockOpen, Shield } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { PasswordField } from '../../components/forms/PasswordField';
import { TextField } from '../../components/forms/TextField';
import { KilimanjaroMark } from '../../components/icons/KilimanjaroMark';
import { useAuthStore } from '../../lib/auth/authStore';
import { getDefaultRouteForRole } from '../../lib/auth/permissions';
import { login } from './api';
import { loginSchema, type LoginForm } from './schemas';

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [serverError, setServerError] = useState('');
  const form = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { username: '', password: '', remember: true } });

  async function onSubmit(values: LoginForm) {
    setServerError('');
    try {
      const session = await login(values.username, values.password);
      setSession(session, values.remember);
      navigate(getDefaultRouteForRole(session.user.role), { replace: true });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'Unable to sign in. Please try again.';
      setServerError(message);
    }
  }

  return (
    <main className="grid min-h-screen bg-ks-paper text-on-surface md:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-ks-navy md:flex md:flex-col md:justify-between">
        <img
          src="/images/login-classroom.webp"
          alt="A Kilimanjaro Schools teacher supporting pupils during a classroom lesson"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-ks-navy/60" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3 p-margin-page text-ks-gold">
          <KilimanjaroMark />
          <h1 className="font-display text-2xl font-bold">Kilimanjaro Schools</h1>
        </div>
        <div className="relative z-10 max-w-xl p-margin-page text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.45)]">
          <div className="mb-6 flex items-center gap-3 text-ks-gold">
            <div className="h-px w-12 bg-ks-gold" />
            <span className="text-[10px] font-black uppercase tracking-widest">Staff Portal Access</span>
          </div>
          <h2 className="font-display text-4xl font-bold leading-tight lg:text-5xl">Your whole school, working together.</h2>
          <p className="mt-5 max-w-lg text-base font-medium leading-7 text-white/85 lg:text-lg lg:leading-8">One place for teachers, administrators and the finance team to get their work done smoothly, without switching systems.</p>
        </div>
        <p className="relative z-10 mx-margin-page border-t border-white/20 py-5 text-xs font-bold text-white/65">Copyright 2026 Kilimanjaro Schools Group. Version 1.0.0</p>
      </section>

      <section className="flex min-h-screen flex-col items-center overflow-y-auto bg-ks-paper p-6 [color-scheme:light]">
        <div className="my-auto w-full max-w-[440px] py-8">
          <div className="mb-8 flex items-center gap-3 md:hidden"><KilimanjaroMark /><span className="font-display text-2xl font-bold text-ks-navy">Kilimanjaro Schools</span></div>
          <div className="w-full rounded-xl border border-ks-line bg-white p-8 shadow-sm">
            <div className="mb-8">
              <div className="mb-2 flex items-center gap-2 text-ks-gold"><LockOpen className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-wider">Secure Access</span></div>
              <h3 className="font-display text-2xl font-bold text-ks-navy">Staff Portal Login</h3>
              <p className="mt-1 text-sm text-ks-muted">Sign in to reach your workspace.</p>
            </div>
            <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
              <TextField label="Username or Email" placeholder="name.office@ks.ac.tz" error={form.formState.errors.username?.message} {...form.register('username')} />
              <div>
                <div className="mb-2 flex justify-between"><span className="text-sm font-bold text-ks-navy">Password</span><Link className="text-xs font-bold text-ks-blue hover:underline" to="/forgot-password">Forgot password?</Link></div>
                <PasswordField label="" placeholder="********" error={form.formState.errors.password?.message} {...form.register('password')} />
              </div>
              <label className="flex items-center gap-2 text-sm text-ks-muted"><input className="rounded border-ks-line text-ks-blue" type="checkbox" {...form.register('remember')} /> Remember this device</label>
              {serverError ? <p className="rounded-lg border border-ks-rose/20 bg-ks-rose/10 p-3 text-sm font-bold text-ks-rose">{serverError}</p> : null}
              <Button className="w-full bg-ks-navy py-4 hover:bg-ks-slate" loading={form.formState.isSubmitting}>Sign In</Button>
            </form>
            <div className="mt-8 flex items-center justify-between border-t border-ks-line pt-6">
              <div className="flex items-center gap-2 text-ks-muted"><Shield className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-tight">Secure gateway /api/v1</span></div>
              <div className="h-1 w-12 rounded-full bg-ks-gold" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
