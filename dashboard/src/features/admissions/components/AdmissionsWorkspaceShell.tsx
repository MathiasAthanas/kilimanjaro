import { ChevronRight, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { useAuthStore } from '../../../lib/auth/authStore';
import { useAdmissionsAnalytics, type AdmissionStage } from '../api/admissions.hooks';

// ─── Shell ────────────────────────────────────────────────────────────────────

export function AdmissionsWorkspaceShell({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const session = useAuthStore((state) => state.session);
  const userName = session?.user?.name ?? 'Admissions Officer';
  const { data: analytics } = useAdmissionsAnalytics();
  const active = analytics?.totals?.active ?? 0;
  const enrolled = analytics?.totals?.enrolled ?? 0;
  const conversion = analytics?.totals?.conversionRate ?? 0;

  return (
    <div className="min-h-[calc(100vh-80px)] space-y-gutter bg-[#f7f9fb]">
      <section className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white shadow-sm">
        <div className="relative overflow-hidden border-b border-[#d5dde6]">
          <div className="absolute inset-0 bg-[linear-gradient(105deg,#f7f9fb_0%,#eef5f8_40%,#dce9f0_100%)]" />
          <div className="relative grid gap-6 p-7 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex items-start gap-4">
              <div className="mt-1 h-full w-1 self-stretch rounded-full bg-[#00334f]" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d59a1b]">{eyebrow}</p>
                <h1 className="mt-1 font-display text-[38px] font-black leading-tight tracking-[-0.025em] text-[#00334f]">
                  {title}
                </h1>
                <p className="mt-1 text-sm font-semibold text-[#64748b]">{userName} · Admissions Office</p>
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-2 xl:pt-1">
              <HeaderStat label="Active Pipeline" value={String(active)} />
              <HeaderStat label="Enrolled" value={String(enrolled)} />
              <HeaderStat label="Conversion" value={`${conversion}%`} danger={conversion < 20 && (analytics?.totals?.total ?? 0) > 0} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 bg-[#f7f9fb] px-5 py-3">
          {action ?? (
            <NavLink to="/admissions/intake">
              <Button className="rounded bg-[#00334f] py-2 text-xs hover:bg-[#001e30] hover:shadow-none">
                <Plus className="h-3.5 w-3.5" /> New Inquiry
              </Button>
            </NavLink>
          )}
        </div>
      </section>

      {children}
    </div>
  );
}

function HeaderStat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="min-w-[110px] rounded border border-[#d5dde6] bg-white px-4 py-3 text-center">
      <p className="text-[9px] font-black uppercase tracking-widest text-[#64748b]">{label}</p>
      <p className={`mt-1 font-mono text-sm font-black tabular-nums ${danger ? 'text-[#e11d48]' : 'text-[#00334f]'}`}>{value}</p>
    </div>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

export function AdmissionsBreadcrumb({ crumbs }: { crumbs: Array<{ label: string; to?: string }> }) {
  return (
    <nav className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider">
      {crumbs.map((crumb, i) => (
        <span key={crumb.label} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-[#c1c7cf]" />}
          {crumb.to ? (
            <NavLink to={crumb.to} className="text-[#64748b] transition hover:text-[#00334f]">{crumb.label}</NavLink>
          ) : (
            <span className="text-[#00334f]">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ─── Stage badge ──────────────────────────────────────────────────────────────

export const STAGE_META: Record<AdmissionStage, { label: string; desc: string; color: string; bg: string; border: string; dot: string }> = {
  INQUIRY:     { label: 'Inquiry',     desc: 'First contact captured',      color: '#b45309', bg: '#fef9ee', border: '#d59a1b', dot: '#d59a1b' },
  APPLICATION: { label: 'Application', desc: 'Formal application received', color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc', dot: '#0284c7' },
  ASSESSMENT:  { label: 'Assessment',  desc: 'Entrance test / interview',   color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', dot: '#8b5cf6' },
  OFFER:       { label: 'Offer',       desc: 'Awaiting guardian decision',  color: '#0f766e', bg: '#f0fdfa', border: '#5eead4', dot: '#14b8a6' },
  ACCEPTED:    { label: 'Accepted',    desc: 'Ready to enrol',              color: '#047857', bg: '#f0fdf9', border: '#6ee7b7', dot: '#10b981' },
  ENROLLED:    { label: 'Enrolled',    desc: 'Now an active student',       color: '#4338ca', bg: '#f5f3ff', border: '#c4b5fd', dot: '#6366f1' },
  REJECTED:    { label: 'Rejected',    desc: 'Application declined',        color: '#be123c', bg: '#fff1f2', border: '#fda4af', dot: '#e11d48' },
  WITHDRAWN:   { label: 'Withdrawn',   desc: 'Family stepped back',         color: '#475569', bg: '#f8fafc', border: '#cbd5e1', dot: '#64748b' },
};

export function StageBadge({ stage }: { stage: AdmissionStage }) {
  const tone =
    stage === 'ENROLLED' || stage === 'ACCEPTED' ? 'emerald'
    : stage === 'REJECTED' ? 'rose'
    : stage === 'WITHDRAWN' ? 'slate'
    : stage === 'OFFER' ? 'blue'
    : 'amber';
  return <Badge tone={tone}>{STAGE_META[stage]?.label ?? stage}</Badge>;
}

// ─── Metric strip (same visual contract as the finance strip) ─────────────────

export function AdmissionsMetricStrip({
  items,
}: {
  items: Array<{
    label: string;
    value: string;
    detail: string;
    tone: 'navy' | 'green' | 'red' | 'gold' | 'slate';
    trend?: 'up' | 'down';
    progress?: number;
  }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const rail =
          item.tone === 'green' ? 'border-l-[#10b981]' :
          item.tone === 'red'   ? 'border-l-[#e11d48]' :
          item.tone === 'gold'  ? 'border-l-[#d59a1b]' :
          item.tone === 'slate' ? 'border-l-[#64748b]' :
          'border-l-[#00334f]';
        const trendColor =
          item.tone === 'red' ? 'text-[#e11d48]' :
          item.tone === 'green' ? 'text-[#10b981]' :
          'text-[#64748b]';
        return (
          <div key={item.label} className={`rounded-lg border border-[#d5dde6] border-l-4 bg-white p-6 ${rail}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">{item.label}</p>
            <p className="mt-2 font-mono text-[34px] font-black leading-none tabular-nums text-[#0f172a]">{item.value}</p>
            <div className="mt-2 flex items-center gap-1">
              {item.trend === 'up' && <TrendingUp className={`h-3.5 w-3.5 ${trendColor}`} />}
              {item.trend === 'down' && <TrendingDown className={`h-3.5 w-3.5 ${trendColor}`} />}
              <p className={`text-xs font-bold ${trendColor}`}>{item.detail}</p>
            </div>
            {item.progress !== undefined && (
              <div className="mt-3 h-1.5 rounded-full bg-[#e2e8f0]">
                <div
                  className={`h-full rounded-full transition-all ${
                    item.tone === 'green' ? 'bg-[#10b981]' :
                    item.tone === 'red'   ? 'bg-[#e11d48]' :
                    item.tone === 'gold'  ? 'bg-[#d59a1b]' :
                    'bg-[#00334f]'
                  }`}
                  style={{ width: `${Math.min(100, item.progress)}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

export function AdmissionsTable({ columns, children, minWidth = 900 }: { columns: string[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className="bg-[#eef5f8]">
            <tr>
              {columns.map((col) => (
                <th key={col} className="border-b border-[#d5dde6] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#00334f]">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Td({ children, amount = false }: { children: ReactNode; amount?: boolean }) {
  return <td className={`px-4 py-3 font-semibold text-[#334155] ${amount ? 'text-right' : ''}`}>{children}</td>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function applicantFullName(a: { firstName: string; middleName?: string | null; lastName: string }) {
  return [a.firstName, a.middleName, a.lastName].filter(Boolean).join(' ');
}

export function formatAdmissionsDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const SOURCE_CHANNEL_LABELS: Record<string, string> = {
  WALK_IN: 'Walk-in',
  REFERRAL: 'Referral',
  WEBSITE: 'Website',
  SOCIAL_MEDIA: 'Social Media',
  PHONE_CALL: 'Phone Call',
  SCHOOL_EVENT: 'School Event',
  OTHER: 'Other',
};
