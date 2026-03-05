// ─── Roles ───────────────────────────────────────────────────────────────────

export enum Role {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  BOARD_DIRECTOR = 'BOARD_DIRECTOR',
  MANAGING_DIRECTOR = 'MANAGING_DIRECTOR',
  PRINCIPAL = 'PRINCIPAL',
  ACADEMIC_QA = 'ACADEMIC_QA',
  FINANCE = 'FINANCE',
  HEAD_OF_DEPARTMENT = 'HEAD_OF_DEPARTMENT',
  TEACHER = 'TEACHER',
  PARENT = 'PARENT',
  STUDENT = 'STUDENT',
}

// ─── Login Identifier Types ───────────────────────────────────────────────────

export enum LoginIdentifierType {
  EMAIL = 'EMAIL',
  REGISTRATION_NUMBER = 'REGISTRATION_NUMBER', // Students only
}

// ─── JWT Payload ──────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;        // user ID
  email?: string;
  regNumber?: string; // for students
  role: Role;
  iat?: number;
  exp?: number;
}

// ─── Standard API Response ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUser {
  id: string;
  role: Role;
  email?: string;
  regNumber?: string;
}

// ─── RabbitMQ Queue Names ─────────────────────────────────────────────────────

export enum Queue {
  NOTIFICATION = 'notification_queue',
  AUTH_EVENTS = 'auth_events_queue',
  STUDENT_EVENTS = 'student_events_queue',
  FINANCE_EVENTS = 'finance_events_queue',
  ACADEMIC_EVENTS = 'academic_events_queue',
}

// ─── Service Ports ────────────────────────────────────────────────────────────

export enum ServicePort {
  API_GATEWAY = 3000,
  AUTH = 3001,
  STUDENT = 3002,
  ACADEMIC = 3003,
  FINANCE = 3004,
  NOTIFICATION = 3005,
  ANALYTICS = 3006,
}

// ─── Service URLs (internal) ──────────────────────────────────────────────────

export const SERVICE_URLS = {
  AUTH: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  STUDENT: process.env.STUDENT_SERVICE_URL || 'http://localhost:3002',
  ACADEMIC: process.env.ACADEMIC_SERVICE_URL || 'http://localhost:3003',
  FINANCE: process.env.FINANCE_SERVICE_URL || 'http://localhost:3004',
  NOTIFICATION: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
  ANALYTICS: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3006',
} as const;
