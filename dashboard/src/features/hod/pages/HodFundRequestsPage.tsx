import { HodWorkspaceShell } from '../components/HodWorkspaceShell';
import { useAuthStore } from '../../../lib/auth/authStore';
import { FundRequestBoard } from '../../finance/components/FundRequestBoard';

export function HodFundRequestsPage() {
  const userName = useAuthStore((s) => s.session?.user?.name) ?? 'Head of Department';
  return (
    <HodWorkspaceShell title="Fund Requests" eyebrow="Request & track department funding">
      <FundRequestBoard role="hod" userName={userName} />
    </HodWorkspaceShell>
  );
}
