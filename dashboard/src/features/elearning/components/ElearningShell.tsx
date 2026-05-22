import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

export function ElearningShell({ title, eyebrow, children, action }: { title: string; eyebrow: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-[#dedaff] bg-gradient-to-br from-[#f7f6ff] via-white to-[#eaf7ff] p-7 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#6C63FF]">{eyebrow}</p>
            <h1 className="mt-2 font-display text-4xl font-black text-ks-slate">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-ks-muted">
              Course spaces, lessons, materials, assignments, quizzes, parent visibility, and engagement analytics are prepared with mock data until backend integration is approved.
            </p>
          </div>
          {action}
        </div>
      </div>
      {children}
    </div>
  );
}

export function ElButton({ to, children }: { to: string; children: ReactNode }) {
  return <NavLink to={to} className="rounded-2xl bg-[#6C63FF] px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-[#3D35CC]">{children}</NavLink>;
}

export function ElStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-widest text-ks-muted">{label}</p>
      <p className="mt-3 font-display text-3xl font-black text-ks-slate">{value}</p>
      <p className="mt-1 text-sm font-semibold text-ks-muted">{detail}</p>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return <div className="h-2 overflow-hidden rounded-full bg-[#EEEDFF]"><div className="h-full rounded-full bg-[#6C63FF]" style={{ width: `${value}%` }} /></div>;
}

export function PublishBadge({ status }: { status: string }) {
  const tone = status === 'ACTIVE' || status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : status === 'DRAFT' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${tone}`}>{status}</span>;
}
