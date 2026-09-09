import { useMemo, useState } from 'react';
import {
  ArrowRight, Calendar, Check, ChevronDown, ChevronUp,
  GraduationCap, Phone, Plus, X,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/common/Button';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonCards } from '../../../components/common/SkeletonCards';
import { toast } from '../../../lib/toast';
import {
  useApplicants,
  useOfferDecisionMutation,
  useTransitionStageMutation,
  type AdmissionStage,
  type ApplicantRow,
} from '../api/admissions.hooks';
import {
  applicantFullName,
  formatAdmissionsDate,
  SOURCE_CHANNEL_LABELS,
  STAGE_META,
} from './AdmissionsWorkspaceShell';

type ActionKind = 'advance' | 'reject' | 'withdraw' | 'accept-offer' | 'decline-offer' | 'reopen';

const ACTIVE_PIPELINE: AdmissionStage[] = ['INQUIRY', 'APPLICATION', 'ASSESSMENT', 'OFFER', 'ACCEPTED'];
const CLOSED_STAGES: AdmissionStage[] = ['ENROLLED', 'REJECTED', 'WITHDRAWN'];

/** Next stage when the officer clicks "Advance" on a card. */
const ADVANCE_TARGET: Partial<Record<AdmissionStage, AdmissionStage>> = {
  INQUIRY: 'APPLICATION',
  APPLICATION: 'ASSESSMENT',
};

const ACTION_COPY: Record<ActionKind, { title: string; confirm: string; tone: 'navy' | 'green' | 'red' | 'slate' }> = {
  advance:         { title: 'Advance applicant',        confirm: 'Advance',        tone: 'navy' },
  reject:          { title: 'Reject application',       confirm: 'Reject',         tone: 'red' },
  withdraw:        { title: 'Mark as withdrawn',        confirm: 'Withdraw',       tone: 'slate' },
  'accept-offer':  { title: 'Record offer acceptance',  confirm: 'Offer Accepted', tone: 'green' },
  'decline-offer': { title: 'Record offer decline',     confirm: 'Offer Declined', tone: 'red' },
  reopen:          { title: 'Reopen as new inquiry',    confirm: 'Reopen',         tone: 'navy' },
};

// ─── Card ─────────────────────────────────────────────────────────────────────

function ApplicantCard({
  applicant,
  onAction,
  expanded,
  onToggle,
}: {
  applicant: ApplicantRow;
  onAction: (kind: ActionKind) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const stage = applicant.stage;
  const daysInPipeline = Math.max(0, Math.round((Date.now() - new Date(applicant.createdAt).getTime()) / 86_400_000));
  const classLabel = applicant.prospectiveClass
    ? `${applicant.prospectiveClass.name}${applicant.prospectiveClass.stream ? ` ${applicant.prospectiveClass.stream}` : ''}`
    : 'Class not set';
  const events = applicant.stageEvents ?? [];

  const canAdvance = stage === 'INQUIRY' || stage === 'APPLICATION';
  const canOfferDecision = stage === 'OFFER';
  const canReject = ['INQUIRY', 'APPLICATION', 'ASSESSMENT', 'OFFER'].includes(stage);
  const canWithdraw = ['INQUIRY', 'APPLICATION', 'ASSESSMENT', 'OFFER', 'ACCEPTED'].includes(stage);

  return (
    <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-2.5">
        <div className="min-w-0">
          <NavLink to={`/admissions/applicants/${applicant.id}`} className="block truncate text-sm font-bold leading-snug text-[#0f172a] hover:text-[#00334f] hover:underline">
            {applicantFullName(applicant)}
          </NavLink>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#475569]">
            <GraduationCap className="h-3 w-3" /> {classLabel}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold text-[#64748b]">
          {SOURCE_CHANNEL_LABELS[applicant.sourceChannel] ?? applicant.sourceChannel}
        </span>
      </div>

      <div className="space-y-1 border-t border-[#f1f5f9] px-3.5 py-2">
        <p className="flex items-center gap-1 text-[11px] font-semibold text-[#64748b]">
          <Phone className="h-2.5 w-2.5" /> {applicant.guardianFirstName} {applicant.guardianLastName} · {applicant.guardianPhone}
        </p>
        <p className="flex items-center gap-1 text-[10px] font-bold text-[#94a3b8]">
          <Calendar className="h-2.5 w-2.5" /> In pipeline {daysInPipeline} day{daysInPipeline === 1 ? '' : 's'}
        </p>
        {applicant.notes && <p className="line-clamp-2 text-[11px] leading-snug text-[#94a3b8]">{applicant.notes}</p>}
      </div>

      {events.length > 0 && (
        <>
          <button
            onClick={onToggle}
            className="flex w-full items-center justify-between border-t border-[#f1f5f9] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#64748b] hover:bg-[#f8fafc]">
            <span>{events.length} event{events.length !== 1 ? 's' : ''}</span>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {expanded && (
            <div className="space-y-2 border-t border-[#f1f5f9] bg-[#f8fafc] px-3.5 py-2">
              {events.slice(0, 6).map((event) => (
                <div key={event.id} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00334f]" />
                  <div>
                    <span className="text-[10px] font-black text-[#00334f]">{STAGE_META[event.toStage]?.label ?? event.toStage}</span>
                    {event.note && <p className="text-[10px] italic text-[#94a3b8]">{event.note}</p>}
                    <p className="text-[10px] text-[#cbd5e1]">{formatAdmissionsDate(event.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-[#f1f5f9] px-3.5 py-2.5">
        {canAdvance && (
          <ActionBtn tone="navy" icon={<ArrowRight className="h-3 w-3" />} onClick={() => onAction('advance')}>
            {ADVANCE_TARGET[stage] === 'APPLICATION' ? 'To Application' : 'To Assessment'}
          </ActionBtn>
        )}
        {stage === 'ASSESSMENT' && (
          <NavLink to={`/admissions/applicants/${applicant.id}`}>
            <ActionBtn tone="green" icon={<Check className="h-3 w-3" />} onClick={() => undefined}>Record & Offer</ActionBtn>
          </NavLink>
        )}
        {canOfferDecision && (
          <>
            <ActionBtn tone="green" icon={<Check className="h-3 w-3" />} onClick={() => onAction('accept-offer')}>Accepted</ActionBtn>
            <ActionBtn tone="red" icon={<X className="h-3 w-3" />} onClick={() => onAction('decline-offer')}>Declined</ActionBtn>
          </>
        )}
        {stage === 'ACCEPTED' && (
          <NavLink to={`/admissions/applicants/${applicant.id}`}>
            <ActionBtn tone="indigo" icon={<GraduationCap className="h-3 w-3" />} onClick={() => undefined}>Enrol Student</ActionBtn>
          </NavLink>
        )}
        {canReject && (
          <ActionBtn tone="red" icon={<X className="h-3 w-3" />} onClick={() => onAction('reject')}>Reject</ActionBtn>
        )}
        {canWithdraw && (
          <ActionBtn tone="slate" onClick={() => onAction('withdraw')}>Withdrawn</ActionBtn>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  children, onClick, tone, icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: 'navy' | 'green' | 'indigo' | 'red' | 'slate';
  icon?: React.ReactNode;
}) {
  const cls: Record<string, string> = {
    navy:   'border-[#00334f]/20 text-[#00334f]   hover:bg-[#eef5f8]',
    green:  'border-emerald-200  text-emerald-700  hover:bg-emerald-50',
    indigo: 'border-indigo-200   text-indigo-700   hover:bg-indigo-50',
    red:    'border-red-200      text-red-600      hover:bg-red-50',
    slate:  'border-slate-200    text-slate-600    hover:bg-slate-50',
  };
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition ${cls[tone]}`}>
      {icon}{children}
    </button>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function AdmissionsPipelineBoard() {
  const navigate = useNavigate();
  const { data: applicants = [], isLoading } = useApplicants();
  const [action, setAction] = useState<{ kind: ActionKind; applicant: ApplicantRow } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showClosed, setShowClosed] = useState(false);

  const byStage = useMemo(() => {
    const map: Partial<Record<AdmissionStage, ApplicantRow[]>> = {};
    applicants.forEach((a) => { (map[a.stage] ??= []).push(a); });
    return map;
  }, [applicants]);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const closedTotal = CLOSED_STAGES.reduce((sum, stage) => sum + (byStage[stage]?.length ?? 0), 0);
  const activeTotal = ACTIVE_PIPELINE.reduce((sum, stage) => sum + (byStage[stage]?.length ?? 0), 0);

  if (isLoading) return <SkeletonCards count={5} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#64748b]">Admissions Pipeline</p>
          <p className="mt-0.5 text-sm font-semibold text-[#64748b]">
            {applicants.length} total · {activeTotal} active
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/admissions/intake')}>
          <Plus className="h-4 w-4" /> New Inquiry
        </Button>
      </div>

      {!applicants.length && (
        <div className="rounded-xl border border-dashed border-[#d5dde6] bg-white p-6">
          <EmptyState
            title="No applicants yet"
            description="Capture the first inquiry to start tracking prospective students from first contact to enrolment."
          />
          <div className="mt-4 flex justify-center">
            <Button variant="primary" onClick={() => navigate('/admissions/intake')}>
              <Plus className="h-4 w-4" /> New Inquiry
            </Button>
          </div>
        </div>
      )}

      {applicants.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {ACTIVE_PIPELINE.map((stage) => {
            const meta = STAGE_META[stage];
            const cards = byStage[stage] ?? [];
            return (
              <div key={stage} className="flex flex-col gap-3">
                <div
                  className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
                  style={{ background: meta.bg, border: `1.5px solid ${meta.border}` }}>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide" style={{ color: meta.color }}>{meta.label}</p>
                      <p className="text-[10px] text-[#64748b]">{meta.desc}</p>
                    </div>
                  </div>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-white" style={{ background: meta.dot }}>
                    {cards.length}
                  </span>
                </div>

                {cards.length === 0 ? (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-[#e2e8f0] py-8 text-[11px] text-[#cbd5e1]">
                    No applicants
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {cards.map((applicant) => (
                      <ApplicantCard
                        key={applicant.id}
                        applicant={applicant}
                        onAction={(kind) => setAction({ kind, applicant })}
                        expanded={expanded.has(applicant.id)}
                        onToggle={() => toggleExpanded(applicant.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {closedTotal > 0 && (
        <div className="rounded-xl border border-[#e2e8f0] bg-white">
          <button
            onClick={() => setShowClosed((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl px-5 py-3.5 text-sm font-bold text-[#64748b] hover:bg-[#f8fafc]">
            <span>Completed & closed ({closedTotal})</span>
            {showClosed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showClosed && (
            <div className="grid gap-4 border-t border-[#f1f5f9] p-4 sm:grid-cols-3">
              {CLOSED_STAGES.map((stage) => {
                const cards = byStage[stage] ?? [];
                if (!cards.length) return null;
                const meta = STAGE_META[stage];
                return (
                  <div key={stage}>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest" style={{ color: meta.color }}>
                      {meta.label} ({cards.length})
                    </p>
                    <div className="space-y-2">
                      {cards.map((applicant) => (
                        <div key={applicant.id} className={`rounded-lg border border-[#e2e8f0] px-3.5 py-2.5 ${stage === 'ENROLLED' ? 'bg-[#f5f3ff]' : 'bg-[#f8fafc] opacity-80'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <NavLink to={`/admissions/applicants/${applicant.id}`} className="min-w-0 truncate text-sm font-bold text-[#475569] hover:text-[#00334f] hover:underline">
                              {applicantFullName(applicant)}
                            </NavLink>
                            <span className="shrink-0 text-[10px] font-black text-[#94a3b8]">{formatAdmissionsDate(applicant.updatedAt ?? applicant.createdAt)}</span>
                          </div>
                          {stage === 'WITHDRAWN' && (
                            <button
                              onClick={() => setAction({ kind: 'reopen', applicant })}
                              className="mt-1.5 text-[10px] font-black uppercase tracking-wide text-[#00334f] hover:underline">
                              Reopen as inquiry
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {action && <StageActionModal action={action} onClose={() => setAction(null)} />}
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function StageActionModal({
  action,
  onClose,
}: {
  action: { kind: ActionKind; applicant: ApplicantRow };
  onClose: () => void;
}) {
  const { kind, applicant } = action;
  const copy = ACTION_COPY[kind];
  const [note, setNote] = useState('');
  const transition = useTransitionStageMutation();
  const offerDecision = useOfferDecisionMutation();
  const busy = transition.isPending || offerDecision.isPending;

  const targetStage: AdmissionStage | null =
    kind === 'advance' ? ADVANCE_TARGET[applicant.stage] ?? null
    : kind === 'reject' ? 'REJECTED'
    : kind === 'withdraw' ? 'WITHDRAWN'
    : kind === 'reopen' ? 'INQUIRY'
    : null;

  const handleConfirm = () => {
    const onDone = {
      onSuccess: () => { toast(`${applicantFullName(applicant)} updated`, 'success'); onClose(); },
      onError: (error: unknown) => {
        const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast(message || 'Action failed. Please try again.', 'error');
      },
    };
    if (kind === 'accept-offer' || kind === 'decline-offer') {
      offerDecision.mutate({ id: applicant.id, decision: kind === 'accept-offer' ? 'ACCEPTED' : 'DECLINED', note: note || undefined }, onDone);
    } else if (targetStage) {
      transition.mutate({ id: applicant.id, toStage: targetStage, note: note || undefined }, onDone);
    }
  };

  const toneClass =
    copy.tone === 'green' ? 'bg-emerald-600 hover:bg-emerald-700'
    : copy.tone === 'red' ? 'bg-red-600 hover:bg-red-700'
    : copy.tone === 'slate' ? 'bg-slate-600 hover:bg-slate-700'
    : 'bg-[#00334f] hover:bg-[#001e30]';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d59a1b]">Admissions Pipeline</p>
        <h2 className="mt-1 font-display text-2xl font-black text-[#00334f]">{copy.title}</h2>
        <p className="mt-2 text-sm font-semibold text-[#64748b]">
          {applicantFullName(applicant)}
          {targetStage ? <> → <span className="font-black text-[#00334f]">{STAGE_META[targetStage].label}</span></> : null}
        </p>
        <label className="mt-4 block">
          <span className="text-xs font-black uppercase text-[#64748b]">Note {kind === 'reject' ? '(required)' : '(optional)'}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={kind === 'reject' ? 'State the reason for rejection…' : 'Add context for the timeline…'}
            className="mt-2 h-24 w-full rounded-xl border border-[#d5dde6] p-3 text-sm font-semibold outline-none focus:border-[#00334f]"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" className="rounded-xl" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            className={`rounded-xl ${toneClass}`}
            disabled={busy || (kind === 'reject' && !note.trim())}
            onClick={handleConfirm}
          >
            {busy ? 'Saving…' : copy.confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}
