import { PrincipalWorkspaceShell } from '../components/PrincipalWorkspaceShell';
import { FinancialStatementReport } from '../../finance/components/FinancialStatementReport';

export function PrincipalFinancialStatementPage() {
  return (
    <PrincipalWorkspaceShell title="Financial Statement" eyebrow="School finances · PDF & Excel">
      <FinancialStatementReport />
    </PrincipalWorkspaceShell>
  );
}
