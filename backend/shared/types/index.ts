// ─── Roles ───────────────────────────────────────────────────────────────────
export enum Role {
  SYSTEM_ADMIN       = 'SYSTEM_ADMIN',
  BOARD_DIRECTOR     = 'BOARD_DIRECTOR',
  MANAGING_DIRECTOR  = 'MANAGING_DIRECTOR',
  PRINCIPAL          = 'PRINCIPAL',
  ACADEMIC_QA        = 'ACADEMIC_QA',
  FINANCE            = 'FINANCE',
  HEAD_OF_DEPARTMENT = 'HEAD_OF_DEPARTMENT',
  TEACHER            = 'TEACHER',
  PARENT             = 'PARENT',
  STUDENT            = 'STUDENT',
}

// ─── Login identifier type ────────────────────────────────────────────────────
export enum LoginType {
  EMAIL             = 'EMAIL',           // all roles except student
  REGISTRATION_NUMBER = 'REGISTRATION_NUMBER', // students only
}

// ─── JWT Payload (what gets encoded in the token) ────────────────────────────
export interface JwtPayload {
  sub: string;        // user ID
  role: Role;
  loginType: LoginType;
  schoolId: string;
  iat?: number;
  exp?: number;
}

// ─── Standard API response shape ─────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── RabbitMQ event names (contracts) ────────────────────────────────────────
export enum RmqEvent {
  // Auth events
  USER_CREATED        = 'user.created',
  USER_DEACTIVATED    = 'user.deactivated',
  PASSWORD_RESET      = 'user.password_reset',

  // Student events
  STUDENT_ENROLLED    = 'student.enrolled',
  STUDENT_PROMOTED    = 'student.promoted',

  // Finance events
  PAYMENT_RECEIVED    = 'payment.received',
  INVOICE_GENERATED   = 'invoice.generated',
  FEE_REMINDER        = 'fee.reminder',

  // Academic events
  RESULTS_PUBLISHED   = 'results.published',
  MARKS_SUBMITTED     = 'marks.submitted',

  // Notification events
  SEND_EMAIL          = 'notification.send_email',
  SEND_SMS            = 'notification.send_sms',
  SEND_PUSH           = 'notification.send_push',
}
