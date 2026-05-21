import { Bell, BookOpen, Calendar, CreditCard, Megaphone, Settings, ShieldAlert, TrendingUp } from 'lucide-react';

export const notifications = [
  {
    id: 'notif-001',
    title: 'Finance: Fee Collection Target Reached',
    preview: 'The Secondary 1 annual fee collection target has been achieved for the current term.',
    category: 'Finance',
    status: 'Success',
    time: '2 mins ago',
    unread: true,
    icon: CreditCard,
    tone: 'emerald' as const,
  },
  {
    id: 'notif-002',
    title: 'AQA: New Performance Alert',
    preview: 'Form 4 Mathematics dip detected in the mid-term assessment. Average score fell by 14%.',
    category: 'Academic',
    status: 'Academic Alert',
    time: '1 hour ago',
    unread: true,
    icon: TrendingUp,
    tone: 'rose' as const,
  },
  {
    id: 'notif-003',
    title: 'System: Scheduled Maintenance',
    preview: 'The Staff Portal will be offline for database optimization on Sunday 02:00.',
    category: 'System',
    status: 'System',
    time: 'Yesterday',
    unread: true,
    icon: Settings,
    tone: 'amber' as const,
  },
  {
    id: 'notif-004',
    title: 'Academic: Staff Meeting Minutes',
    preview: 'The minutes from the Tuesday Academic Committee meeting have been published.',
    category: 'Announcement',
    status: 'Read',
    time: '2 days ago',
    unread: false,
    icon: BookOpen,
    tone: 'slate' as const,
  },
];

export const announcements = [
  {
    id: 'ann-001',
    title: 'Term 1 Academic Review Window',
    audience: 'All academic staff',
    status: 'Active',
    date: 'May 20, 2026',
    priority: 'High',
    body: 'The academic review period is now open. HODs should complete marks review, AQA should verify performance alerts, and teachers should resolve pending marks corrections before publishing readiness checks.',
    icon: Calendar,
  },
  {
    id: 'ann-002',
    title: 'Finance Office Collection Reconciliation',
    audience: 'Finance, Principal',
    status: 'Active',
    date: 'May 18, 2026',
    priority: 'Medium',
    body: 'Finance collection reports for the current term must be reconciled before invoice regeneration and statement printing.',
    icon: CreditCard,
  },
  {
    id: 'ann-003',
    title: 'System Access Audit',
    audience: 'Admin, Principal',
    status: 'Active',
    date: 'May 16, 2026',
    priority: 'High',
    body: 'The system administrator should review locked accounts, stale sessions, and privileged role changes.',
    icon: ShieldAlert,
  },
  {
    id: 'ann-004',
    title: 'Parent Communication Standards',
    audience: 'Teachers, HOD, AQA',
    status: 'Expired',
    date: 'May 10, 2026',
    priority: 'Low',
    body: 'All parent-facing announcements should use clear, respectful, and action-oriented language.',
    icon: Megaphone,
  },
];

export const searchResults = [
  { type: 'Student', title: 'Amina Baraka Juma', meta: 'Form 3A · academic profile', to: '/analytics/students/stu-0001-amina-baraka-juma' },
  { type: 'Class', title: 'Form 3A Mathematics', meta: 'Teacher: Rose Mhina · Term 1', to: '/teacher/classes/form3a-math' },
  { type: 'Finance', title: 'Outstanding Balances Report', meta: 'Finance report · sensitive export', to: '/reports/finance/outstanding-balances' },
  { type: 'Announcement', title: 'Term 1 Academic Review Window', meta: 'Active · all academic staff', to: '/app/announcements/ann-001' },
  { type: 'Help', title: 'How to reset a locked user account', meta: 'Admin help center', to: '/app/help' },
];

export const helpCards = [
  { title: 'Login and security', text: 'Password reset, session expiry, account lock and device access.', icon: ShieldAlert },
  { title: 'Academic workflows', text: 'Marks entry, HOD approval, results publishing and report cards.', icon: BookOpen },
  { title: 'Finance workflows', text: 'Payments, receipts, invoices, statements and collections reports.', icon: CreditCard },
  { title: 'Notifications', text: 'Announcements, unread alerts, preferences and message delivery.', icon: Bell },
];
