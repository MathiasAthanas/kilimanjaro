import { PrincipalWorkspaceShell } from '../components/PrincipalWorkspaceShell';
import { useAuthStore } from '../../../lib/auth/authStore';
import { FundRequestBoard } from '../../finance/components/FundRequestBoard';

export function PrincipalFundApprovalsPage() {
  const userName = useAuthStore((s) => s.session?.user?.name) ?? 'Principal';
  return (
    <PrincipalWorkspaceShell title="Fund Approvals" eyebrow="Approve departmental funding">
      <FundRequestBoard role="principal" userName={userName} />
    </PrincipalWorkspaceShell>
  );
}
