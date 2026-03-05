// ─── Auth Events ─────────────────────────────────────────────────────────────

export const AUTH_EVENTS = {
  USER_REGISTERED: 'auth.user.registered',
  USER_LOGIN: 'auth.user.login',
  PASSWORD_RESET_REQUESTED: 'auth.password.reset_requested',
  PASSWORD_CHANGED: 'auth.password.changed',
  USER_DEACTIVATED: 'auth.user.deactivated',
} as const;

export interface UserRegisteredEvent {
  userId: string;
  email?: string;
  regNumber?: string;
  role: string;
  createdAt: Date;
}

export interface UserLoginEvent {
  userId: string;
  role: string;
  ip?: string;
  userAgent?: string;
  loginAt: Date;
}

export interface PasswordResetRequestedEvent {
  userId: string;
  email: string;
  resetToken: string;
  expiresAt: Date;
}

// ─── Student Events ───────────────────────────────────────────────────────────

export const STUDENT_EVENTS = {
  STUDENT_ENROLLED: 'student.enrolled',
  STUDENT_PROMOTED: 'student.promoted',
  STUDENT_TRANSFERRED: 'student.transferred',
  STUDENT_SUSPENDED: 'student.suspended',
} as const;

export interface StudentEnrolledEvent {
  studentId: string;
  userId: string; // auth user ID
  classId: string;
  enrolledAt: Date;
}

// ─── Finance Events ───────────────────────────────────────────────────────────

export const FINANCE_EVENTS = {
  PAYMENT_RECEIVED: 'finance.payment.received',
  INVOICE_GENERATED: 'finance.invoice.generated',
  PAYMENT_OVERDUE: 'finance.payment.overdue',
} as const;

export interface PaymentReceivedEvent {
  paymentId: string;
  studentId: string;
  amount: number;
  currency: string;
  method: string;
  paidAt: Date;
}

// ─── Notification Events ──────────────────────────────────────────────────────

export const NOTIFICATION_EVENTS = {
  SEND_EMAIL: 'notification.email.send',
  SEND_SMS: 'notification.sms.send',
  SEND_PUSH: 'notification.push.send',
} as const;

export interface SendEmailEvent {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export interface SendSmsEvent {
  to: string;       // phone number with country code
  message: string;
}

export interface SendPushEvent {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// ─── Academic Events ──────────────────────────────────────────────────────────

export const ACADEMIC_EVENTS = {
  RESULTS_PUBLISHED: 'academic.results.published',
  MARKS_SUBMITTED: 'academic.marks.submitted',
  MARKS_APPROVED: 'academic.marks.approved',
} as const;

export interface ResultsPublishedEvent {
  termId: string;
  classId: string;
  publishedBy: string;
  publishedAt: Date;
}
