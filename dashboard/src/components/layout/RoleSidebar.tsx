import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  Banknote,
  CircleHelp,
  ClipboardCheck,
  Download,
  FileText,
  FileSpreadsheet,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Lock,
  LogOut,
  Megaphone,
  MessageSquarePlus,
  PenLine,
  PieChart,
  Search,
  Settings,
  Shield,
  Target,
  TrendingUp,
  User,
  Users,
  Video,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/auth/authStore';
import { KilimanjaroMark } from '../icons/KilimanjaroMark';
import { NavItem } from '../navigation/NavItem';

type SidebarSection = {
  title: string;
  items: Array<{ to: string; icon: LucideIcon; label: string; end?: boolean }>;
};

// ─── Teacher ─────────────────────────────────────────────────────────────────

const teacherSections: SidebarSection[] = [
  {
    title: 'Teacher Desk',
    items: [
      { to: '/teacher',            icon: LayoutDashboard, label: 'Home Dashboard', end: true },
      { to: '/teacher/classes',    icon: Users,           label: 'My Classes',     end: true },
      { to: '/teacher/assessments',icon: BookOpen,        label: 'Assessments',    end: true },
      { to: '/teacher/attendance', icon: CalendarCheck,   label: 'Attendance',     end: true },
    ],
  },
  {
    title: 'Academic Work',
    items: [
      { to: '/teacher/assessments', icon: FileSpreadsheet, label: 'Marks Entry',      end: true },
      { to: '/teacher/syllabus',    icon: Target,          label: 'Syllabus Tracker', end: true },
      { to: '/teacher/timetable',   icon: CalendarCheck,   label: 'Timetable',        end: true },
    ],
  },
  {
    title: 'E-Learning',
    items: [
      { to: '/teacher/elearning', icon: GraduationCap, label: 'E-Learning Center', end: true },
    ],
  },
  {
    title: 'Student Support',
    items: [
      { to: '/teacher/performance/alerts',   icon: AlertTriangle,    label: 'Performance Alerts', end: true },
      { to: '/teacher/performance/pairings', icon: Users,            label: 'Peer Pairings',      end: true },
      { to: '/teacher/interventions/create', icon: MessageSquarePlus,label: 'Create Intervention'           },
    ],
  },
  {
    title: 'Communication',
    items: [
      { to: '/teacher/announcements',        icon: Megaphone,        label: 'Announcements',      end: true },
      { to: '/teacher/announcements/create', icon: MessageSquarePlus,label: 'Create Announcement'           },
      { to: '/teacher/exports',              icon: Download,         label: 'Export Center'                 },
    ],
  },
];

// ─── HOD ─────────────────────────────────────────────────────────────────────

const hodSections: SidebarSection[] = [
  {
    title: 'HOD Command',
    items: [
      { to: '/hod',                                             icon: Landmark,       label: 'Command Center',  end: true },
      { to: '/hod/approvals',                                   icon: ClipboardCheck, label: 'Pending Approvals', end: true },
      { to: '/hod/approvals/hod-appr-chem-3b-midterm',         icon: FileSpreadsheet,label: 'Review Oldest'              },
      { to: '/hod/approvals/history',                           icon: FileText,       label: 'Approval History'           },
    ],
  },
  {
    title: 'Department',
    items: [
      { to: '/hod/department',                      icon: Target, label: 'Department Overview', end: true },
      { to: '/hod/department/subjects/chemistry',   icon: Shield, label: 'Chemistry Risk'                 },
      { to: '/hod/teachers',                        icon: Users,  label: 'Teacher Matrix',      end: true },
      { to: '/hod/teachers/teacher-amina',          icon: User,   label: 'Teacher Detail'                 },
    ],
  },
  {
    title: 'E-Learning',
    items: [
      { to: '/hod/elearning',                                          icon: GraduationCap, label: 'Dept. Overview',    end: true },
      { to: '/hod/elearning/courses/course-form3a-math',               icon: BookOpen,      label: 'Mathematics F3A'             },
      { to: '/hod/elearning/courses/course-form2a-physics',            icon: Video,         label: 'Physics F2A'                 },
      { to: '/hod/elearning/courses/course-form3b-math',               icon: FileText,      label: 'Mathematics F3B'             },
    ],
  },
  {
    title: 'Performance',
    items: [
      { to: '/hod/performance',           icon: AlertTriangle,    label: 'Risk Alerts',   end: true },
      { to: '/hod/performance/pairings',  icon: Users,            label: 'Peer Pairings'            },
      { to: '/hod/students/stu-jabir',    icon: User,             label: 'Student Profile'          },
      { to: '/hod/interventions',         icon: MessageSquarePlus,label: 'Interventions'            },
    ],
  },
  {
    title: 'Records',
    items: [
      { to: '/hod/announcements',        icon: Megaphone,        label: 'Announcements',      end: true },
      { to: '/hod/announcements/create', icon: MessageSquarePlus,label: 'Create Announcement'           },
      { to: '/hod/exports',              icon: Download,         label: 'Export Center'                 },
      { to: '/hod/audit',                icon: Shield,           label: 'Audit Trail'                   },
    ],
  },
];

// ─── AQA ─────────────────────────────────────────────────────────────────────

const aqaSections: SidebarSection[] = [
  {
    title: 'AQA Command',
    items: [
      { to: '/aqa',                                              icon: LayoutDashboard, label: 'Command Center',      end: true },
      { to: '/aqa/performance',                                  icon: AlertTriangle,   label: 'Performance Center',  end: true },
      { to: '/aqa/performance/alerts/alert-jabir-chem',         icon: Shield,          label: 'Alert Investigation'            },
      { to: '/aqa/performance/pairings',                        icon: Users,           label: 'Peer Pairings'                  },
    ],
  },
  {
    title: 'Engine',
    items: [
      { to: '/aqa/performance/engine',        icon: FileSpreadsheet, label: 'Engine Control', end: true },
      { to: '/aqa/performance/engine/config', icon: Settings,        label: 'Engine Config'             },
      { to: '/aqa/analytics',                 icon: BarChart3,       label: 'Academic Radar', end: true },
      { to: '/aqa/analytics/classes/form-3b', icon: Target,          label: 'Class Analytics'           },
    ],
  },
  {
    title: 'E-Learning',
    items: [
      { to: '/aqa/elearning', icon: GraduationCap, label: 'Quality Audit',   end: true },
      { to: '/aqa/elearning', icon: PenLine,        label: 'Standards Check'           },
      { to: '/aqa/audit',     icon: Shield,         label: 'E-Learning Audit'          },
    ],
  },
  {
    title: 'Students',
    items: [
      { to: '/aqa/students/at-risk',  icon: Users,            label: 'At-Risk Students' },
      { to: '/aqa/students/stu-jabir',icon: User,             label: 'Student Profile'  },
      { to: '/aqa/interventions',     icon: MessageSquarePlus,label: 'Interventions'    },
      { to: '/aqa/reports',           icon: FileText,         label: 'Reports Hub'      },
    ],
  },
  {
    title: 'Records',
    items: [
      { to: '/aqa/announcements',        icon: Megaphone,        label: 'Announcements',      end: true },
      { to: '/aqa/announcements/create', icon: MessageSquarePlus,label: 'Create Announcement'           },
      { to: '/aqa/exports',              icon: Download,         label: 'Export Center'                 },
      { to: '/aqa/audit',                icon: Shield,           label: 'Audit Trail'                   },
    ],
  },
];

// ─── Finance ─────────────────────────────────────────────────────────────────

const financeSections: SidebarSection[] = [
  {
    title: 'Finance Desk',
    items: [
      { to: '/finance',                   icon: WalletCards,    label: 'Finance Home',     end: true },
      { to: '/finance/invoices',          icon: FileText,       label: 'Invoice Ledger',   end: true },
      { to: '/finance/invoices/generate', icon: FileSpreadsheet,label: 'Generate Invoices'           },
      { to: '/finance/payments',          icon: Banknote,       label: 'Payment Ledger',   end: true },
    ],
  },
  {
    title: 'Payments',
    items: [
      { to: '/finance/payments/cash',    icon: WalletCards,   label: 'Cash Payment'        },
      { to: '/finance/payments/bank',    icon: Landmark,      label: 'Bank Transfer'       },
      { to: '/finance/payments/pending', icon: ClipboardCheck,label: 'Pending Approvals'   },
      { to: '/finance/receipts',         icon: FileText,      label: 'Receipts', end: true },
    ],
  },
  {
    title: 'Fee Setup',
    items: [
      { to: '/finance/fee-categories',         icon: Settings,       label: 'Fee Categories',  end: true },
      { to: '/finance/fee-structures',         icon: FileSpreadsheet,label: 'Fee Structures',  end: true },
      { to: '/finance/fee-structures/matrix',  icon: BarChart3,      label: 'Fee Matrix'                },
      { to: '/finance/fee-assignments',        icon: Users,          label: 'Fee Assignments'           },
    ],
  },
  {
    title: 'Control Room',
    items: [
      { to: '/finance/assets',                icon: Landmark,     label: 'Assets Ledger',   end: true },
      { to: '/finance/reports',               icon: BarChart3,    label: 'Reports Hub',     end: true },
      { to: '/finance/reports/fee-defaulters',icon: AlertTriangle,label: 'Fee Defaulters'             },
      { to: '/finance/audit',                 icon: Shield,       label: 'Audit Log'                  },
      { to: '/finance/exports',               icon: Download,     label: 'Export Center'              },
    ],
  },
];

// ─── Principal ───────────────────────────────────────────────────────────────

const principalSections: SidebarSection[] = [
  {
    title: 'Executive',
    items: [
      { to: '/principal',           icon: Shield,   label: 'Decision Room', end: true },
      { to: '/principal/analytics', icon: BarChart3,label: 'Analytics',     end: true },
      { to: '/principal/reports',   icon: PieChart, label: 'Reports',       end: true },
      { to: '/principal/exports',   icon: Download, label: 'Exports',       end: true },
    ],
  },
  {
    title: 'E-Learning',
    items: [
      { to: '/principal/elearning', icon: GraduationCap, label: 'School Overview',    end: true },
      { to: '/principal/analytics', icon: BarChart3,     label: 'Adoption Analytics'           },
      { to: '/principal/reports',   icon: TrendingUp,    label: 'Learning Report'              },
    ],
  },
  {
    title: 'Academic Decisions',
    items: [
      { to: '/principal/approvals',       icon: ClipboardCheck,label: 'Marks Approval',  end: true },
      { to: '/principal/results/publish', icon: Lock,          label: 'Publish Results'            },
      { to: '/principal/report-cards',    icon: BookOpen,      label: 'Report Cards',    end: true },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/principal/finance',           icon: WalletCards,label: 'Finance Oversight', end: true },
      { to: '/principal/finance/approvals', icon: Banknote,   label: 'Payment Approval',  end: true },
      { to: '/principal/finance/invoices',  icon: FileText,   label: 'Invoice View'                },
    ],
  },
  {
    title: 'People & School',
    items: [
      { to: '/principal/performance',   icon: TrendingUp,   label: 'Performance',   end: true },
      { to: '/principal/students',      icon: Users,        label: 'Students',      end: true },
      { to: '/principal/discipline',    icon: AlertTriangle,label: 'Discipline',    end: true },
      { to: '/principal/staff',         icon: GraduationCap,label: 'Staff',         end: true },
      { to: '/principal/announcements', icon: Megaphone,    label: 'Announcements', end: true },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/principal/settings/school', icon: Settings, label: 'School Settings', end: true },
      { to: '/principal/audit',           icon: Shield,   label: 'Decision Audit',  end: true },
    ],
  },
];

// ─── Admin ───────────────────────────────────────────────────────────────────

const adminSections: SidebarSection[] = [
  {
    title: 'Admin Console',
    items: [
      { to: '/admin',               icon: Shield,       label: 'System Center',  end: true },
      { to: '/admin/users',         icon: Users,        label: 'Users',          end: true },
      { to: '/admin/students',      icon: GraduationCap,label: 'Students',       end: true },
      { to: '/admin/academic/setup',icon: BookOpen,     label: 'Academic Setup'            },
      { to: '/admin/classes',       icon: Landmark,     label: 'Classes',        end: true },
      { to: '/admin/subjects',      icon: Target,       label: 'Subjects',       end: true },
    ],
  },
  {
    title: 'E-Learning',
    items: [
      { to: '/admin/elearning',                   icon: GraduationCap,   label: 'Administration',      end: true },
      { to: '/admin/notifications/templates',     icon: Bell,            label: 'Notification Events'            },
      { to: '/admin/audit/system',                icon: Shield,          label: 'E-Learning Audit'               },
      { to: '/admin/settings/system',             icon: Settings,        label: 'Storage & Policy'               },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { to: '/admin/grading',                              icon: FileSpreadsheet, label: 'Grading',             end: true },
      { to: '/admin/assessment-types',                     icon: ClipboardCheck,  label: 'Assessment Types'              },
      { to: '/admin/academic/stage-config',                icon: BookOpen,        label: 'Stage Config'                  },
      { to: '/admin/academic/promotion/cross-stage',       icon: GraduationCap,   label: 'Cross-Stage Promotion'         },
      { to: '/admin/finance/fee-categories',               icon: WalletCards,     label: 'Fee Categories'                },
      { to: '/admin/performance/engine',                   icon: TrendingUp,      label: 'Performance Engine'            },
      { to: '/admin/settings/system',                      icon: Settings,        label: 'System Settings'               },
    ],
  },
  {
    title: 'Notifications',
    items: [
      { to: '/admin/notifications/templates', icon: MessageSquarePlus,label: 'Templates',          end: true },
      { to: '/admin/notifications/send',      icon: Megaphone,        label: 'Manual Send'                    },
      { to: '/admin/notifications/logs',      icon: FileText,         label: 'Notification Logs'              },
      { to: '/admin/announcements',           icon: Megaphone,        label: 'Announcements Admin'            },
    ],
  },
  {
    title: 'Reports & Audit',
    items: [
      { to: '/admin/analytics',    icon: BarChart3,   label: 'Full Analytics'  },
      { to: '/admin/reports',      icon: PieChart,    label: 'Any Report'      },
      { to: '/admin/audit/finance',icon: WalletCards, label: 'Finance Audit'   },
      { to: '/admin/audit/system', icon: Shield,      label: 'System Audit'    },
      { to: '/reports',            icon: Download,    label: 'Shared Reports'  },
      { to: '/timetables',         icon: CalendarCheck,label: 'Timetables'     },
    ],
  },
];

// ─── Generic / fallback ───────────────────────────────────────────────────────

const genericSections: SidebarSection[] = [
  {
    title: 'Workspaces',
    items: [
      { to: '/app/profile', icon: LayoutDashboard, label: 'Workspace Home'      },
      { to: '/teacher',     icon: User,            label: 'Teacher Dashboard'   },
      { to: '/hod',         icon: Landmark,        label: 'Academic Affairs'    },
      { to: '/finance',     icon: WalletCards,     label: 'Finance Hub'         },
      { to: '/principal',   icon: Shield,          label: 'Principal Command'   },
      { to: '/admin',       icon: Settings,        label: 'Admin Settings'      },
      { to: '/reports',     icon: BarChart3,       label: 'Reports'             },
    ],
  },
];

const sharedSections: SidebarSection[] = [
  {
    title: 'Shared',
    items: [
      { to: '/app/notifications',  icon: Bell,    label: 'Notifications'        },
      { to: '/app/announcements',  icon: Megaphone,label: 'School Announcements'},
      { to: '/app/search',         icon: Search,  label: 'Global Search'        },
    ],
  },
];

// ─── Role resolver ────────────────────────────────────────────────────────────

function getSectionsForRole(role: string | undefined): SidebarSection[] {
  if (role === 'TEACHER')   return [...teacherSections,   ...sharedSections];
  if (role === 'HOD')       return [...hodSections,        ...sharedSections];
  if (role === 'AQA')       return [...aqaSections,        ...sharedSections];
  if (role === 'FINANCE')   return [...financeSections,    ...sharedSections];
  if (role === 'PRINCIPAL') return [...principalSections,  ...sharedSections];
  if (role === 'ADMIN')     return [...adminSections,      ...sharedSections];
  return [...genericSections, ...sharedSections];
}

// ─── Component ────────────────────────────────────────────────────────────────

type RoleSidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
};

export function RoleSidebar({ mobileOpen, onClose }: RoleSidebarProps) {
  const session  = useAuthStore((state) => state.session);
  const logout   = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const sections = getSectionsForRole(session?.user.role);

  useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[59] bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-[60] flex h-full w-sidebar-width flex-col gap-4 bg-ks-navy py-6 shadow-lg transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* ── Brand ── */}
        <div className="px-5">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-ks-mist/50 transition hover:bg-ks-mist/10 hover:text-ks-mist lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
          <h1 className="font-display text-xl font-bold text-ks-gold">Kilimanjaro Schools</h1>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-lg border border-ks-mist/10 bg-ks-mist/20">
              <KilimanjaroMark className="h-full w-full" />
            </div>
            <div>
              <p className="text-sm font-bold text-ks-mist">Staff Portal</p>
              <p className="text-[10px] uppercase tracking-wider text-ks-mist/50">Operational Center</p>
            </div>
          </div>
        </div>

        {/* ── Nav sections ── */}
        <nav className="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto px-2 pb-2">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-4 pb-1 text-[10px] font-black uppercase tracking-[0.22em] text-ks-mist/40">
                {section.title}
              </p>
              <div className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <NavItem
                    key={item.to + item.label}
                    to={item.to}
                    icon={item.icon}
                    label={item.label}
                    end={item.end}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Footer ── */}
        <div className="mt-auto flex flex-col gap-1 border-t border-ks-mist/10 px-2 pt-4">
          <NavItem to="/app/help" icon={CircleHelp} label="Help Support" />
          <button
            className="flex items-center gap-3 overflow-hidden rounded-lg px-4 py-3 text-left text-sm font-bold text-ks-mist/70 transition-all hover:bg-ks-mist/5 hover:text-ks-rose"
            onClick={() => { logout(); navigate('/login'); }}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Sign Out
          </button>
          <div className="mx-2 mt-2 rounded-lg border border-ks-mist/10 bg-ks-mist/5 p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ks-gold/20 font-display text-sm font-bold text-ks-gold">
                {session?.user.name?.slice(0, 2)?.toUpperCase() ?? 'KS'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ks-mist">{session?.user.name ?? 'Staff User'}</p>
                <p className="text-[10px] uppercase tracking-wider text-ks-mist/50">{session?.user.role ?? 'No role'}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
