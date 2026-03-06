import { PrismaClient, NotificationChannel } from '@prisma/client';

const prisma = new PrismaClient();

type TemplateSeed = {
  eventType: string;
  channel: NotificationChannel;
  name: string;
  subject?: string;
  body: string;
  smsBody?: string;
  variables: string[];
};

const templates: TemplateSeed[] = [
  {
    eventType: 'user.created',
    channel: 'EMAIL',
    name: 'User Created Email',
    subject: 'Welcome to Kilimanjaro Schools',
    body: 'Hello {{firstName}}, your {{role}} account is ready. {{registrationNumber}}',
    variables: ['firstName', 'role', 'registrationNumber'],
  },
  {
    eventType: 'password.reset.requested',
    channel: 'SMS',
    name: 'Password Reset SMS',
    body: 'OTP {{otp}} valid for {{expiresInMinutes}} minutes.',
    smsBody: 'Kilimanjaro Schools: Your password reset OTP is {{otp}}. Valid for 10 minutes. Do not share.',
    variables: ['otp', 'expiresInMinutes', 'firstName'],
  },
  {
    eventType: 'password.reset.requested',
    channel: 'EMAIL',
    name: 'Password Reset Email',
    subject: 'Password Reset OTP',
    body: 'Hi {{firstName}}, your OTP is {{otp}} and expires in {{expiresInMinutes}} minutes.',
    variables: ['firstName', 'otp', 'expiresInMinutes'],
  },
  {
    eventType: 'account.locked',
    channel: 'EMAIL',
    name: 'Account Locked Email',
    subject: 'Account Locked',
    body: 'Your account is locked until {{lockedUntil}} after {{failedAttempts}} attempts.',
    variables: ['firstName', 'lockedUntil', 'failedAttempts'],
  },
  {
    eventType: 'student.enrolled',
    channel: 'SMS',
    name: 'Student Enrolled SMS',
    body: 'Kilimanjaro Schools: {{studentName}} (Reg: {{registrationNumber}}) has been enrolled in {{className}}. Welcome!',
    smsBody: 'Kilimanjaro Schools: {{studentName}} enrolled in {{className}}.',
    variables: ['studentName', 'registrationNumber', 'className', 'academicYear', 'admissionDate'],
  },
  {
    eventType: 'attendance.marked',
    channel: 'SMS',
    name: 'Attendance Absent SMS',
    body: 'Kilimanjaro Schools: {{studentName}} was marked ABSENT on {{date}} in {{className}}.',
    smsBody: 'Kilimanjaro Schools: {{studentName}} marked ABSENT on {{date}}.',
    variables: ['studentName', 'date', 'className', 'markedByName'],
  },
  {
    eventType: 'discipline.recorded',
    channel: 'EMAIL',
    name: 'Discipline Alert Email',
    subject: 'Discipline Record for {{studentName}}',
    body: 'Category: {{category}}, Severity: {{severity}}, Action: {{actionTaken}}',
    variables: ['studentName', 'category', 'severity', 'incidentDate', 'actionTaken'],
  },
  {
    eventType: 'performance.alert.created',
    channel: 'EMAIL',
    name: 'Performance Alert Email',
    subject: 'Performance Alert: {{studentName}}',
    body: '{{message}} ({{subjectName}} / {{currentScore}}%)',
    variables: ['studentName', 'subjectName', 'alertType', 'message', 'currentScore', 'suggestedPeerName'],
  },
  {
    eventType: 'performance.alert.positive',
    channel: 'SMS',
    name: 'Positive Performance SMS',
    body: 'Great news! {{studentName}} has shown {{alertType}} in {{subjectName}}.',
    smsBody: 'Great news! {{studentName}} has shown {{alertType}} in {{subjectName}}.',
    variables: ['studentName', 'alertType', 'subjectName', 'currentScore'],
  },
  {
    eventType: 'performance.pairing.suggested',
    channel: 'EMAIL',
    name: 'Pairing Suggested Email',
    subject: 'Peer Pairing Suggested',
    body: 'Pair {{studentName}} with {{peerName}} in {{subjectName}}. {{reason}}',
    variables: ['studentName', 'peerName', 'subjectName', 'reason', 'studentScore', 'peerScore'],
  },
  {
    eventType: 'student.status.changed',
    channel: 'SMS',
    name: 'Student Status Changed SMS',
    body: 'Status of {{studentName}} changed to {{newStatus}} effective {{effectiveDate}}.',
    smsBody: 'Status of {{studentName}} changed to {{newStatus}}.',
    variables: ['studentName', 'newStatus', 'effectiveDate'],
  },
  {
    eventType: 'marks.approval.requested',
    channel: 'EMAIL',
    name: 'Marks Approval Requested Email',
    subject: 'Marks Approval Needed',
    body: '{{teacherName}} submitted {{assessmentName}} for {{className}}',
    variables: ['teacherName', 'subjectName', 'className', 'termName', 'assessmentName'],
  },
  {
    eventType: 'marks.approved',
    channel: 'EMAIL',
    name: 'Marks Approved Email',
    subject: 'Marks Approved',
    body: '{{assessmentName}} for {{className}} approved by {{approvedByName}}.',
    variables: ['assessmentName', 'approvedByName', 'approvedByRole', 'className'],
  },
  {
    eventType: 'marks.rejected',
    channel: 'SMS',
    name: 'Marks Rejected SMS',
    body: 'Marks for {{assessmentName}} were rejected. {{reason}}',
    smsBody: 'Marks for {{assessmentName}} rejected. Reason: {{reason}}.',
    variables: ['assessmentName', 'className', 'rejectedByName', 'reason'],
  },
  {
    eventType: 'results.published',
    channel: 'PUSH',
    name: 'Results Published Push',
    body: "{{studentName}}'s results for {{termName}} are ready!",
    variables: ['studentName', 'termName', 'academicYear', 'className'],
  },
  {
    eventType: 'marks.submission.reminder',
    channel: 'SMS',
    name: 'Marks Submission Reminder SMS',
    body: 'Submit marks for {{assessmentName}} in {{className}}. {{daysUntilDeadline}} day(s) remaining.',
    smsBody: 'Reminder: submit {{assessmentName}} marks. {{daysUntilDeadline}} day(s) remaining.',
    variables: ['teacherName', 'subjectName', 'className', 'assessmentName', 'daysUntilDeadline'],
  },
  {
    eventType: 'alert.escalated',
    channel: 'EMAIL',
    name: 'Alert Escalated Email',
    subject: 'Alert Escalated for {{studentName}}',
    body: '{{alertType}} escalated by {{escalatedByName}} ({{escalatedByRole}}).',
    variables: ['studentName', 'subjectName', 'alertType', 'escalatedByName', 'escalatedByRole'],
  },
  {
    eventType: 'report_card.generated',
    channel: 'PUSH',
    name: 'Report Card Generated Push',
    body: "{{studentName}}'s report card for {{termName}} is ready.",
    variables: ['studentName', 'termName'],
  },
  {
    eventType: 'payment.confirmed',
    channel: 'SMS',
    name: 'Payment Confirmed SMS',
    body: 'Payment of {{currency}} {{amount}} received. Receipt {{receiptNumber}}. Balance {{currency}} {{outstandingBalance}}.',
    smsBody: 'Payment {{currency}} {{amount}} received. Receipt {{receiptNumber}}.',
    variables: ['studentName', 'amount', 'currency', 'method', 'receiptNumber', 'termName', 'outstandingBalance', 'paidAt'],
  },
  {
    eventType: 'invoice.generated',
    channel: 'SMS',
    name: 'Invoice Generated SMS',
    body: 'Invoice {{invoiceNumber}} for {{studentName}} total {{currency}} {{totalAmount}} due {{dueDate}}.',
    smsBody: 'Invoice {{invoiceNumber}} total {{currency}} {{totalAmount}} due {{dueDate}}.',
    variables: ['studentName', 'termName', 'totalAmount', 'currency', 'dueDate', 'invoiceNumber'],
  },
  {
    eventType: 'fee.overdue',
    channel: 'SMS',
    name: 'Fee Overdue SMS',
    body: 'URGENT: {{studentName}} fees overdue by {{daysOverdue}} day(s). Outstanding {{currency}} {{outstandingBalance}}.',
    smsBody: 'URGENT: {{studentName}} fees overdue by {{daysOverdue}} day(s).',
    variables: ['studentName', 'termName', 'outstandingBalance', 'currency', 'daysOverdue', 'invoiceNumber'],
  },
  {
    eventType: 'fee.reminder',
    channel: 'SMS',
    name: 'Fee Reminder SMS',
    body: 'Reminder: {{studentName}} fees {{currency}} {{outstandingBalance}} due {{dueDate}}.',
    smsBody: 'Reminder: {{studentName}} fees due {{dueDate}}.',
    variables: ['studentName', 'termName', 'outstandingBalance', 'currency', 'dueDate', 'daysUntilDue'],
  },
  {
    eventType: 'manual.payment.approved',
    channel: 'EMAIL',
    name: 'Manual Payment Approved Email',
    subject: 'Manual Payment Approved',
    body: 'Manual payment for {{studentName}} approved.',
    variables: ['studentName', 'amount', 'currency', 'receiptNumber', 'paidAt'],
  },
  {
    eventType: 'payment.rejected',
    channel: 'SMS',
    name: 'Payment Rejected SMS',
    body: 'Payment entry for {{studentName}} ({{amount}}) rejected: {{rejectionReason}}',
    smsBody: 'Payment for {{studentName}} rejected: {{rejectionReason}}.',
    variables: ['studentName', 'amount', 'rejectionReason', 'enteredByName'],
  },
  {
    eventType: 'receipt.generated',
    channel: 'EMAIL',
    name: 'Receipt Generated Email',
    subject: 'Receipt {{receiptNumber}}',
    body: 'Receipt {{receiptNumber}} of {{amount}} ready: {{pdfUrl}}',
    variables: ['studentName', 'receiptNumber', 'amount', 'pdfUrl'],
  },
];

async function main() {
  for (const template of templates) {
    await prisma.notificationTemplate.upsert({
      where: {
        eventType_channel_language: {
          eventType: template.eventType,
          channel: template.channel,
          language: 'en',
        },
      },
      update: {
        name: template.name,
        subject: template.subject,
        body: template.body,
        smsBody: template.smsBody,
        isActive: true,
        variables: template.variables,
        updatedById: 'seed',
      },
      create: {
        eventType: template.eventType,
        channel: template.channel,
        name: template.name,
        subject: template.subject,
        body: template.body,
        smsBody: template.smsBody,
        isActive: true,
        language: 'en',
        variables: template.variables,
        createdById: 'seed',
      },
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
