import { Eye, TrendingUp, WalletCards } from 'lucide-react';
import { PrincipalBreadcrumb, PrincipalWorkspaceShell } from '../components/PrincipalWorkspaceShell';
import { FinancialStatementReport } from '../../finance/components/FinancialStatementReport';
import { usePrincipalFinanceOverview } from '../api/principal.hooks';

export function PrincipalFinancialStatementPage() {
  const { data: finance } = usePrincipalFinanceOverview() as {
    data?: { collectionRate: number; totalCollected: number; totalOutstanding: number; overdueCount: number };
  };

  const rate        = finance?.collectionRate ?? null;
  const collected   = finance?.totalCollected ?? null;
  const outstanding = finance?.totalOutstanding ?? null;
  const overdueCount = finance?.overdueCount ?? null;

  return (
    <PrincipalWorkspaceShell title="Financial Statement" eyebrow="School finances · executive read-only view">
      <PrincipalBreadcrumb crumbs={[
        { label: 'Executive', to: '/principal' },
        { label: 'Finance', to: '/principal/finance' },
        { label: 'Financial Statement' },
      ]} />

      {/* Live summary strip */}
      <div className="grid gap-gutter sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-ks-line bg-white p-4 shadow-sm">
          <TrendingUp className="h-5 w-5 shrink-0 text-ks-emerald" />
          <div>
            <p className={`text-lg font-black ${rate !== null ? (rate >= 80 ? 'text-ks-emerald' : rate >= 60 ? 'text-ks-amber' : 'text-ks-rose') : 'text-ks-muted'}`}>
              {rate !== null ? `${rate.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs font-semibold text-ks-muted">Collection rate</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-ks-line bg-white p-4 shadow-sm">
          <WalletCards className="h-5 w-5 shrink-0 text-ks-blue" />
          <div>
            <p className="text-lg font-black text-ks-navy">
              {collected !== null ? `TZS ${collected.toLocaleString('en-US')}` : '—'}
            </p>
            <p className="text-xs font-semibold text-ks-muted">Total collected</p>
          </div>
        </div>
        <div className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm ${outstanding && outstanding > 0 ? 'border-ks-rose/30 bg-ks-rose/5' : 'border-ks-line bg-white'}`}>
          <Eye className={`h-5 w-5 shrink-0 ${outstanding && outstanding > 0 ? 'text-ks-rose' : 'text-ks-muted'}`} />
          <div>
            <p className={`text-lg font-black ${outstanding && outstanding > 0 ? 'text-ks-rose' : 'text-ks-navy'}`}>
              {outstanding !== null ? `TZS ${outstanding.toLocaleString('en-US')}` : '—'}
            </p>
            <p className="text-xs font-semibold text-ks-muted">
              Outstanding {overdueCount !== null ? `· ${overdueCount} overdue` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Read-only notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-ks-blue/20 bg-ks-blue/5 px-5 py-3">
        <Eye className="mt-0.5 h-4 w-4 shrink-0 text-ks-blue" />
        <p className="text-xs font-semibold text-ks-blue">
          Executive read-only view. You can download P&amp;L, balance sheet, and detailed reports below.
          Finance Officers manage entries and reconciliations.
        </p>
      </div>

      <FinancialStatementReport />
    </PrincipalWorkspaceShell>
  );
}
