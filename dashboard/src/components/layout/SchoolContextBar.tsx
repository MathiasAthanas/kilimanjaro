import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Globe2, School as SchoolIcon, Undo2 } from 'lucide-react';
import { useAuthStore } from '../../lib/auth/authStore';
import { isGroupRole } from '../../lib/auth/permissions';
import { useSchoolStore } from '../../lib/school/schoolStore';
import { useSchools } from '../../features/manager/api/manager.hooks';

/**
 * Global school context (Doc 03 §2): shows which school the user is inside.
 * Group roles can jump between All Schools and any school; multi-school heads
 * switch between their schools. Single-school staff see a read-only pill.
 */
export function SchoolContextBar() {
  const session = useAuthStore((s) => s.session);
  const { activeSchool, setActiveSchool } = useSchoolStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Group-only areas (whole-group dashboards). Entering a school from one of
  // these lands on the school's home; switching schools while already inside a
  // school-scoped section (e.g. /admin/users) keeps you on that same section.
  const GROUP_PREFIXES = ['/superadmin', '/manager', '/finance-group'];
  const onGroupPage = GROUP_PREFIXES.some((p) => location.pathname.startsWith(p));

  const role = session?.user.role;
  const groupRole = isGroupRole(role);
  // Where "All Schools (Group)" / "Back to Group" lands, per role. ADMIN has no
  // /manager access (403) — its group home is the Admin Console.
  const groupHome = role === 'SUPER_ADMIN' ? '/superadmin'
    : role === 'HEAD_OF_FINANCE' ? '/finance-group'
    : role === 'ADMIN' ? '/admin'
    : '/manager';
  const scopedIds = session?.user.schoolIds ?? [];
  const multiSchoolHead = role === 'HEAD_OF_SCHOOL' && scopedIds.length > 1;
  const showSwitcher = groupRole || multiSchoolHead;

  const { data: schools = [] } = useSchools();
  const visibleSchools = groupRole ? schools : schools.filter((s) => scopedIds.includes(s.id));

  // Auto-scope single-school heads so every request carries their school
  if (role === 'HEAD_OF_SCHOOL' && !activeSchool && visibleSchools.length === 1) {
    const only = visibleSchools[0];
    setActiveSchool({ id: only.id, name: only.name, code: only.code, type: only.type, gender: only.gender });
  }

  if (!session || (!showSwitcher && !activeSchool)) return null;

  return (
    <div className="border-b border-[#d5dde6] bg-white px-5 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <button
            onClick={() => showSwitcher && setOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-black transition ${
              activeSchool
                ? 'border-[#d59a1b]/50 bg-[#fffbeb] text-[#7a5200]'
                : 'border-[#00334f]/30 bg-[#eef5f8] text-[#00334f]'
            } ${showSwitcher ? 'hover:shadow' : 'cursor-default'}`}
          >
            {activeSchool ? <SchoolIcon className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}
            {activeSchool ? activeSchool.name : 'All Schools (Group)'}
            {showSwitcher && <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {open && (
            <div className="absolute left-0 top-full z-[60] mt-2 w-80 overflow-hidden rounded-2xl border border-[#d5dde6] bg-white shadow-xl">
              {groupRole && (
                <button
                  onClick={() => { setActiveSchool(null); setOpen(false); navigate(role === 'MANAGER' ? '/manager/overview' : groupHome); }}
                  className="flex w-full items-center gap-3 border-b border-[#eef2f6] px-4 py-3 text-left hover:bg-[#eef5f8]"
                >
                  <Globe2 className="h-5 w-5 text-[#00334f]" />
                  <div>
                    <p className="font-black text-[#00334f]">All Schools (Group)</p>
                    <p className="text-[11px] font-semibold text-[#64748b]">Whole-group dashboards and totals</p>
                  </div>
                </button>
              )}
              {visibleSchools.map((school) => (
                <button
                  key={school.id}
                  onClick={() => {
                    setActiveSchool({ id: school.id, name: school.name, code: school.code, type: school.type, gender: school.gender });
                    setOpen(false);
                    // Only jump to the school home when coming from a group-only
                    // page; otherwise stay on the current section for the new school.
                    if (onGroupPage) navigate('/principal');
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#eef5f8]"
                >
                  <SchoolIcon className="h-5 w-5 text-[#0284c7]" />
                  <div>
                    <p className="font-black text-[#00334f]">{school.name}</p>
                    <p className="text-[11px] font-semibold text-[#64748b]">{school.code} · {school.type} · {school.gender}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {groupRole && activeSchool && (
          <div className="flex items-center gap-2 rounded-full bg-[#d59a1b]/15 px-3 py-1.5 text-xs font-black text-[#7a5200]">
            Viewing as Group Owner
            <button
              onClick={() => { setActiveSchool(null); navigate(groupHome); }}
              className="flex items-center gap-1 rounded-full bg-[#00334f] px-2.5 py-0.5 text-white transition hover:bg-[#001e30]"
            >
              <Undo2 className="h-3 w-3" /> Back to Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
