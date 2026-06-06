import { zodResolver } from '@hookform/resolvers/zod';
import { LockOpen, School, Shield } from 'lucide-react';
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

const demo = [
  ['Admin', 'admin@demo.kilimanjaro.test', 'Admin@Kili2026'],
  ['Principal', 'principal@demo.kilimanjaro.test', 'Principal@Kili2026'],
  ['AQA', 'aqa@demo.kilimanjaro.test', 'Aqa@Kili2026'],
  ['Finance', 'finance@demo.kilimanjaro.test', 'Finance@Kili2026'],
  ['Teacher', 't-english@demo.kilimanjaro.test', 'Teacher@Kili2026'],
  ['HOD', 'hod-science@demo.kilimanjaro.test', 'Hod@Kili2026'],
];

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
      setServerError(error instanceof Error ? error.message : 'Invalid credentials or account locked.');
    }
  }

  function fill(email: string, password: string) {
    form.setValue('username', email, { shouldValidate: true });
    form.setValue('password', password, { shouldValidate: true });
  }

  return (
    <main className="flex min-h-screen flex-col bg-ks-paper text-on-surface md:flex-row">
      <section className="ks-grid-pattern relative hidden flex-1 flex-col justify-between overflow-hidden bg-ks-navy p-margin-page md:flex">
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-ks-blue/20 blur-[100px]" />
        <div className="relative z-10 flex items-center gap-3 text-ks-gold">
          <KilimanjaroMark />
          <h1 className="font-display text-2xl font-bold">Kilimanjaro Schools</h1>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-5xl font-bold leading-tight text-ks-mist">Your whole school, working together.</h2>
          <p className="mt-5 text-lg leading-8 text-ks-mist/70">One place for teachers, administrators and the finance team to get their work done — smoothly and without switching systems.</p>
          <div className="mt-8 flex items-center gap-3 text-ks-gold"><div className="h-px w-12 bg-ks-gold" /><span className="text-[10px] font-black uppercase tracking-widest">Staff Portal Access</span></div>
        </div>
        <p className="relative z-10 border-t border-ks-mist/10 pt-4 text-xs font-bold text-ks-mist/40">© 2026 Kilimanjaro Schools Group. Version 1.0.0</p>
      </section>

      <section className="flex flex-1 flex-col items-center overflow-y-auto bg-ks-paper p-6 [color-scheme:light]">
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
              <PasswordField label="" placeholder="••••••••" error={form.formState.errors.password?.message} {...form.register('password')} />
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
        {import.meta.env.DEV ? (
          <div className="mt-6 w-full rounded-lg border border-ks-line bg-ks-mist/30 p-5">
            <div className="mb-4 flex items-center gap-2 text-ks-navy"><School className="h-5 w-5" /><span className="text-sm font-black">Quick Login (Dev Only)</span></div>
            <div className="grid gap-2">
              {demo.map(([role, email, password]) => <button key={email} className="flex justify-between rounded-lg border border-ks-line bg-white p-3 text-left hover:border-ks-blue" onClick={() => fill(email, password)}><span className="font-bold text-ks-navy">{role}</span><span className="text-xs text-ks-muted">{email}</span></button>)}
            </div>
          </div>
        ) : null}
        </div>
      </section>
    </main>
  );
}
