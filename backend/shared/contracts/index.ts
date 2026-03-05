// RabbitMQ message payload contracts between services

export interface UserCreatedEvent {
  userId: string;
  email: string;
  role: string;
  schoolId: string;
}

export interface PaymentReceivedEvent {
  paymentId: string;
  studentId: string;
  amount: number;
  currency: string;
  method: string;
  referenceNumber: string;
  paidAt: Date;
}

export interface SendEmailEvent {
  to: string;
  subject: string;
  templateId: string;
  variables: Record<string, string>;
}

export interface SendSmsEvent {
  to: string;       // phone number
  message: string;
}

export interface SendPushEvent {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface ResultsPublishedEvent {
  studentId: string;
  termId: string;
  academicYear: string;
  reportCardUrl: string;
}
