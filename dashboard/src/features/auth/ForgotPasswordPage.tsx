import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck, Send, UserRound, Verified } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { TextField } from '../../components/forms/TextField';
import { KilimanjaroMark } from '../../components/icons/KilimanjaroMark';
import { requestPasswordReset } from './api';
import { forgotPasswordSchema, type ForgotPasswordForm } from './schemas';

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const form = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  async function onSubmit(values: ForgotPasswordForm) {
    await requestPasswordReset(values.email);
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-ks-paper text-on-surface">
      <header className="sticky top-0 z-50 flex h-topbar-height items-center justify-between border-b border-ks-line bg-surface/80 px-5 backdrop-blur-md lg:px-margin-page">
        <Link to="/" className="flex items-center gap-3">
          <KilimanjaroMark />
          <span className="font-display text-xl font-bold text-ks-navy">Kilimanjaro Schools</span>
        </Link>
        <div className="hidden items-center gap-8 text-sm font-bold text-ks-muted md:flex">
          <Link className="hover:text-ks-blue" to="/">Public Portal</Link>
          <Link className="hover:text-ks-blue" to="/app/help">Contact Admin</Link>
        </div>
      </header>
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10">
        <div className="pointer-events-none absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-ks-mist/40 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-ks-mist/30 blur-[100px]" />
        <div className="relative z-10 w-full max-w-[480px] overflow-hidden rounded-xl border border-ks-line bg-white shadow-lg">
          <div className="h-1.5 w-full bg-ks-gold" />
          <div className="p-8 lg:p-margin-page">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ks-mist text-ks-navy">
                {sent ? <MailCheck className="h-8 w-8" /> : <UserRound className="h-8 w-8" />}
              </div>
              <h1 className="font-display text-2xl font-bold text-ks-navy">Reset Password Access</h1>
              <p className="mx-auto mt-2 max-w-[320px] text-sm text-ks-muted">
                Enter your registered staff email to receive secure password recovery instructions.
              </p>
            </div>
            {sent ? (
              <div className="rounded-xl border border-ks-emerald/20 bg-ks-emerald/10 p-5">
                <h2 className="font-display text-2xl font-bold text-ks-navy">Link Sent</h2>
                <p className="mt-2 text-sm text-ks-muted">If the account exists, instructions have been dispatched to the registered staff channel.</p>
                <Link to="/login"><Button className="mt-6"><ArrowLeft className="h-4 w-4" /> Return to Login</Button></Link>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
                <TextField label="Staff Email or Username" placeholder="e.g. j.doe@kilimanjaroschools.sc.tz" error={form.formState.errors.email?.message} {...form.register('email')} />
                <Button className="w-full py-4" loading={form.formState.isSubmitting}>Send Reset Link <Send className="h-4 w-4" /></Button>
              </form>
            )}
            <div className="mt-8 flex flex-col items-center gap-3 border-t border-ks-line pt-6">
              <Link className="flex items-center gap-1 text-sm font-bold text-ks-blue hover:underline" to="/login"><ArrowLeft className="h-4 w-4" /> Return to Login</Link>
              <div className="flex items-center gap-2 rounded border border-ks-mist bg-ks-mist/50 px-3 py-1 text-xs font-black text-ks-navy">
                <Verified className="h-4 w-4" /> Secure Staff Portal
              </div>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute right-12 top-1/2 hidden h-[520px] w-[380px] -translate-y-1/2 rotate-3 border border-ks-line bg-ks-mist/20 p-4 opacity-50 lg:block">
          <div className="h-full w-full bg-ks-navy/90 bg-[radial-gradient(circle_at_30%_20%,rgba(244,183,64,0.25),transparent_28%),linear-gradient(135deg,rgba(14,165,233,0.25),transparent_45%)]" />
        </div>
      </main>
    </div>
  );
}
