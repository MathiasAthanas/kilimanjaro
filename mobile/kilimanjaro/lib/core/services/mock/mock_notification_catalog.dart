import '../../../models/notification_model.dart';
import '../../../models/notification_preference_model.dart';
import '../../../models/search_result_model.dart';

Map<NotificationChannel, bool> notificationChannelsAllOn() => {
      NotificationChannel.sms: true,
      NotificationChannel.email: true,
      NotificationChannel.push: true,
      NotificationChannel.inApp: true,
    };

List<NotificationPreferenceModel> defaultNotificationPreferences() {
  return [
    NotificationPreferenceModel(
      key: 'results_published',
      section: 'Academic',
      label: 'Results Published',
      description: 'Receive notice when exam results are published.',
      eventType: NotificationEventType.resultsPublished,
      channels: notificationChannelsAllOn(),
    ),
    NotificationPreferenceModel(
      key: 'marks_review',
      section: 'Academic',
      label: 'Marks Approved / Rejected',
      description: 'Get updates when submitted marks change status.',
      eventType: NotificationEventType.marksApproved,
      channels: notificationChannelsAllOn(),
    ),
    NotificationPreferenceModel(
      key: 'submission_reminders',
      section: 'Academic',
      label: 'Submission Reminders',
      description: 'Assessment and submission reminders.',
      eventType: NotificationEventType.attendanceMarked,
      channels: {
        NotificationChannel.sms: false,
        NotificationChannel.email: true,
        NotificationChannel.push: true,
        NotificationChannel.inApp: true,
      },
    ),
    NotificationPreferenceModel(
      key: 'performance_alerts',
      section: 'Performance',
      label: 'Performance Alerts',
      description: 'Alert me when a learner enters an at-risk band.',
      eventType: NotificationEventType.performanceAlertCreated,
      channels: notificationChannelsAllOn(),
    ),
    NotificationPreferenceModel(
      key: 'peer_pairings',
      section: 'Performance',
      label: 'Peer Pairing Suggestions',
      description: 'Suggestions from the performance engine.',
      eventType: NotificationEventType.studentEnrolled,
      channels: {
        NotificationChannel.sms: false,
        NotificationChannel.email: true,
        NotificationChannel.push: true,
        NotificationChannel.inApp: true,
      },
    ),
    NotificationPreferenceModel(
      key: 'payment_confirmed',
      section: 'Finance',
      label: 'Payment Confirmed',
      description: 'Confirmations for posted and approved payments.',
      eventType: NotificationEventType.paymentConfirmed,
      channels: notificationChannelsAllOn(),
    ),
    NotificationPreferenceModel(
      key: 'invoice_generated',
      section: 'Finance',
      label: 'Invoice Generated',
      description: 'New invoices and updates.',
      eventType: NotificationEventType.announcement,
      channels: notificationChannelsAllOn(),
    ),
    NotificationPreferenceModel(
      key: 'fee_reminders',
      section: 'Finance',
      label: 'Fee Reminders',
      description: 'Friendly reminders before due dates.',
      eventType: NotificationEventType.feeOverdue,
      channels: notificationChannelsAllOn(),
    ),
    NotificationPreferenceModel(
      key: 'fee_overdue',
      section: 'Finance',
      label: 'Fee Overdue',
      description: 'Critical overdue notices.',
      eventType: NotificationEventType.feeOverdue,
      channels: notificationChannelsAllOn(),
    ),
    NotificationPreferenceModel(
      key: 'absent_notifications',
      section: 'Attendance',
      label: 'Absent Notifications',
      description: 'Daily attendance alerts.',
      eventType: NotificationEventType.attendanceMarked,
      channels: notificationChannelsAllOn(),
    ),
    NotificationPreferenceModel(
      key: 'announcements',
      section: 'System',
      label: 'Announcements',
      description: 'School-wide communications and notices.',
      eventType: NotificationEventType.announcement,
      channels: notificationChannelsAllOn(),
    ),
    NotificationPreferenceModel(
      key: 'account_alerts',
      section: 'System',
      label: 'Account Alerts',
      description: 'Security and account updates.',
      eventType: NotificationEventType.disciplineRecorded,
      channels: {
        NotificationChannel.sms: false,
        NotificationChannel.email: true,
        NotificationChannel.push: true,
        NotificationChannel.inApp: true,
      },
    ),
  ];
}

const mockStudents = <SearchResultModel>[
  SearchResultModel(id: 's1', type: SearchResultType.student, title: 'Amina Baraka Juma', subtitle: 'Form 3A', route: '/shell/admin/students', avatarName: 'Amina Baraka Juma', metaLabel: 'KS-2024-00142'),
  SearchResultModel(id: 's2', type: SearchResultType.student, title: 'Zawadi Kipande', subtitle: 'Form 2B', route: '/shell/admin/students', avatarName: 'Zawadi Kipande', metaLabel: 'KS-2024-00152'),
  SearchResultModel(id: 's3', type: SearchResultType.student, title: 'Baraka Mwangi', subtitle: 'Form 1A', route: '/shell/admin/students', avatarName: 'Baraka Mwangi', metaLabel: 'KS-2024-00167'),
  SearchResultModel(id: 's4', type: SearchResultType.student, title: 'Neema Lema', subtitle: 'Form 4C', route: '/shell/admin/students', avatarName: 'Neema Lema', metaLabel: 'KS-2024-00171'),
  SearchResultModel(id: 's5', type: SearchResultType.student, title: 'Hellen Mushi', subtitle: 'Form 3B', route: '/shell/admin/students', avatarName: 'Hellen Mushi', metaLabel: 'KS-2024-00189'),
  SearchResultModel(id: 's6', type: SearchResultType.student, title: 'Goodluck Mrema', subtitle: 'Form 2A', route: '/shell/admin/students', avatarName: 'Goodluck Mrema', metaLabel: 'KS-2024-00201'),
  SearchResultModel(id: 's7', type: SearchResultType.student, title: 'Anna Kileo', subtitle: 'Form 1C', route: '/shell/admin/students', avatarName: 'Anna Kileo', metaLabel: 'KS-2024-00215'),
  SearchResultModel(id: 's8', type: SearchResultType.student, title: 'Rehema Mallya', subtitle: 'Form 3A', route: '/shell/admin/students', avatarName: 'Rehema Mallya', metaLabel: 'KS-2024-00222'),
];

const mockAnnouncements = <SearchResultModel>[
  SearchResultModel(id: 'a1', type: SearchResultType.announcement, title: 'Midterm Examination Timetable', subtitle: 'Published yesterday', route: '/shell/student/announcements'),
  SearchResultModel(id: 'a2', type: SearchResultType.announcement, title: 'Fee Payment Deadline Reminder', subtitle: 'Finance office update', route: '/shell/finance/reports'),
  SearchResultModel(id: 'a3', type: SearchResultType.announcement, title: 'Parents Meeting on Friday', subtitle: 'Principal communication', route: '/shell/principal/announcements'),
  SearchResultModel(id: 'a4', type: SearchResultType.announcement, title: 'Kiswahili Debate Team Training', subtitle: 'Co-curricular office notice', route: '/shell/student/home'),
];
