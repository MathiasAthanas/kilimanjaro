import { CheckCircle, Clock } from 'lucide-react';
import { PrincipalBreadcrumb, PrincipalWorkspaceShell } from '../components/PrincipalWorkspaceShell';
import { useAuthStore } from '../../../lib/auth/authStore';
import { FundRequestBoard } from '../../finance/components/FundRequestBoard';
import { useFundRequests, type FundRequestRow } from '../../finance/api/financeOps.hooks';

export function PrincipalFundApprovalsPage() {
  const userName = useAuthStore((s) => s.session?.user?.name) ?? 'Principal';
  const { data: apiRequests = [] } = useFundRequests() as { data: FundRequestRow[] };

  const pendingCount  = apiRequests.filter((r) => r.status === 'FORWARDED').length;
  const approvedCount = apiRequests.filter((r) => r.status === 'APPROVED' || r.status === 'DISBURSED').length;
  const pendingValue  = apiRequests
    .filter((r) => r.status === 'FORWARDED')
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);

  return (
    <PrincipalWorkspaceShell title="Fund Approvals" eyebrow="Approve departmental funding requests">
      <PrincipalBreadcrumb crumbs={[
        { label: 'Executive', to: '/principal' },
        { label: 'Finance', to: '/principal/finance' },
        { label: 'Fund Approvals' },
      ]} />

      {/* Context banner */}
      <div className="grid gap-gutter sm:grid-cols-3">
        <div className={`flex items-center gap-3 rounded-2xl border p-4 ${pendingCount > 0 ? 'border-ks-amber/30 bg-ks-amber/5' : 'border-ks-line bg-white'}`}>
          <Clock className={`h-5 w-5 shrink-0 ${pendingCount > 0 ? 'text-ks-amber' : 'text-ks-muted'}`} />
          <div>
            <p className={`text-lg font-black ${pendingCount > 0 ? 'text-ks-amber' : 'text-ks-navy'}`}>{pendingCount}</p>
            <p className="text-xs font-semibold text-ks-muted">Awaiting your decision</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-ks-line bg-white p-4">
          <CheckCircle className="h-5 w-5 shrink-0 text-ks-emerald" />
          <div>
            <p className="text-lg font-black text-ks-emerald">{approvedCount}</p>
            <p className="text-xs font-semibold text-ks-muted">Approved this cycle</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-ks-line bg-white p-4">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            <span className="text-[10px] font-black text-ks-navy">TZS</span>
          </div>
          <div>
            <p className="text-lg font-black text-ks-navy">
              {pendingValue > 0 ? pendingValue.toLocaleString('en-US') : '0'}
            </p>
            <p className="text-xs font-semibold text-ks-muted">Pending value</p>
          </div>
        </div>
      </div>

      <FundRequestBoard role="principal" userName={userName} />
    </PrincipalWorkspaceShell>
  );
}
