import { motion } from 'framer-motion';
import { Globe2, School as SchoolIcon } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import {
  SCHOOL_GENDER_LABELS,
  SCHOOL_TYPE_LABELS,
  type SchoolScorecard,
} from '../api/manager.hooks';

const healthRail: Record<SchoolScorecard['health'], string> = {
  GOOD: 'bg-[#10b981]',
  WATCH: 'bg-[#d59a1b]',
  CRITICAL: 'bg-[#e11d48]',
};

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-6 items-end gap-[3px]">
      {values.map((v, i) => (
        <div key={i} className="w-1.5 rounded-t bg-[#0284c7]/60" style={{ height: `${Math.max(12, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}

/**
 * The signature multi-school visual (Doc 03 §3): one card per school with live
 * headline stats, plus a pinned Group card for the whole-group view.
 */
export function SchoolGallery({
  schools,
  groupStats,
  onOpenGroup,
  onOpenSchool,
}: {
  schools: SchoolScorecard[];
  groupStats?: { students: number; collectionRate: number | null; academicMean: number | null };
  onOpenGroup?: () => void;
  onOpenSchool: (school: SchoolScorecard) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {onOpenGroup && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onOpenGroup}
          className="group relative overflow-hidden rounded-2xl border-2 border-[#00334f] bg-[#00334f] p-5 text-left text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
        >
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#d59a1b]">
              <Globe2 className="h-6 w-6 text-[#00334f]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#d59a1b]">Group</p>
              <p className="font-display text-lg font-black leading-tight">All Schools</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div><p className="font-mono text-xl font-black tabular-nums">{groupStats?.students ?? '—'}</p><p className="text-[9px] font-black uppercase tracking-widest text-white/60">Students</p></div>
            <div><p className="font-mono text-xl font-black tabular-nums">{groupStats?.collectionRate != null ? `${groupStats.collectionRate}%` : '—'}</p><p className="text-[9px] font-black uppercase tracking-widest text-white/60">Collected</p></div>
            <div><p className="font-mono text-xl font-black tabular-nums">{groupStats?.academicMean != null ? `${groupStats.academicMean}%` : '—'}</p><p className="text-[9px] font-black uppercase tracking-widest text-white/60">Acad. Mean</p></div>
          </div>
          <p className="mt-4 text-xs font-bold text-[#d59a1b] opacity-0 transition group-hover:opacity-100">Open group dashboard →</p>
        </motion.button>
      )}

      {schools.map((school, index) => (
        <motion.button
          key={school.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * (index + 1) }}
          onClick={() => onOpenSchool(school)}
          className={`group relative overflow-hidden rounded-2xl border border-[#d5dde6] bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${!school.isActive ? 'opacity-60' : ''}`}
        >
          <div className={`absolute inset-x-0 top-0 h-1.5 ${healthRail[school.health]}`} />
          <div className="flex items-center gap-3">
            {school.logoUrl ? (
              <img src={school.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef5f8]">
                <SchoolIcon className="h-6 w-6 text-[#00334f]" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-base font-black leading-tight text-[#00334f]">{school.name}</p>
              <p className="text-[11px] font-bold text-[#64748b]">
                {SCHOOL_TYPE_LABELS[school.type] ?? school.type} · {SCHOOL_GENDER_LABELS[school.gender] ?? school.gender}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div><p className="font-mono text-lg font-black tabular-nums text-[#0f172a]">{school.students}</p><p className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">Students</p></div>
            <div><p className="font-mono text-lg font-black tabular-nums text-[#0f172a]">{school.collectionRate != null ? `${school.collectionRate}%` : '—'}</p><p className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">Collected</p></div>
            <div><p className="font-mono text-lg font-black tabular-nums text-[#0f172a]">{school.academicMean != null ? `${school.academicMean}%` : '—'}</p><p className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">Acad. Mean</p></div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Spark values={[school.attendanceRate ?? 0, school.collectionRate ?? 0, school.academicMean ?? 0, school.capacityFillPct ?? 0]} />
            <div className="flex items-center gap-2">
              {!school.isActive && <Badge tone="slate">INACTIVE</Badge>}
              <Badge tone={school.health === 'GOOD' ? 'emerald' : school.health === 'WATCH' ? 'amber' : 'rose'}>{school.health}</Badge>
            </div>
          </div>
          <p className="mt-3 text-xs font-bold text-[#00334f] opacity-0 transition group-hover:opacity-100">Enter school portal →</p>
        </motion.button>
      ))}
    </div>
  );
}
