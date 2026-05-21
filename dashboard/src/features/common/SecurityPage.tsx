import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { PasswordField } from '../../components/forms/PasswordField';
import { AdvancedIcon } from '../../components/icons/AdvancedIcon';
import { changePassword } from '../auth/api';
import { PageScaffold } from './PageScaffold';

const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8), confirmPassword: z.string().min(8) }).refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords must match' });
type Form = z.infer<typeof schema>;

export function SecurityPage() {
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });
  async function onSubmit(values: Form) {
    await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
    form.reset();
  }
  return (
    <PageScaffold title="Account Security" description="Change password, review sessions and keep staff access secure.">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-6">
          <h2 className="font-display text-2xl font-bold text-ks-navy">Change Password</h2>
          <form className="mt-6 space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            <PasswordField label="Current Password" error={form.formState.errors.currentPassword?.message} {...form.register('currentPassword')} />
            <PasswordField label="New Password" error={form.formState.errors.newPassword?.message} {...form.register('newPassword')} />
            <PasswordField label="Confirm New Password" error={form.formState.errors.confirmPassword?.message} {...form.register('confirmPassword')} />
            <Button loading={form.formState.isSubmitting}>Update Password</Button>
          </form>
        </Card>
        <Card className="bg-ks-navy p-6 text-white">
          <AdvancedIcon icon={ShieldCheck} tone="gold" />
          <h3 className="mt-5 font-display text-2xl font-bold">Security recommendations</h3>
          <p className="mt-3 text-sm leading-6 text-ks-mist/80">Use a unique password, sign out on shared devices, and report any unexpected account activity to the system administrator.</p>
          <div className="mt-6 rounded-lg bg-white/10 p-4"><p className="text-sm font-bold text-ks-gold">Password Strength</p><p className="mt-1 text-sm text-ks-mist/70">Recommended rotation: every 90 days.</p></div>
        </Card>
      </div>
    </PageScaffold>
  );
}
