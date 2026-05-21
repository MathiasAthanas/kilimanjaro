-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "academics";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "analytics";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "finance";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "notifications";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "students";

-- CreateEnum
CREATE TYPE "analytics"."ReportType" AS ENUM ('SCHOOL_OVERVIEW', 'CLASS_ACADEMIC', 'STUDENT_PROFILE', 'FINANCE_COLLECTION', 'OUTSTANDING_BALANCES', 'PERFORMANCE_ENGINE', 'ATTENDANCE_SUMMARY', 'TEACHER_PERFORMANCE', 'TERM_SUMMARY', 'ANNUAL_SUMMARY', 'BOARD_EXECUTIVE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "analytics"."ReportStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "analytics"."DashboardSnapshot" (    "id" TEXT NOT NULL,    "snapshotType" TEXT NOT NULL,    "scope" TEXT NOT NULL,    "scopeId" TEXT,    "period" TEXT NOT NULL,    "data" JSONB NOT NULL,    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "expiresAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "DashboardSnapshot_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "analytics"."KpiHistory" (    "id" TEXT NOT NULL,    "kpiName" TEXT NOT NULL,    "scope" TEXT NOT NULL,    "value" DOUBLE PRECISION NOT NULL,    "period" TEXT NOT NULL,    "academicYearId" TEXT,    "termId" TEXT,    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    CONSTRAINT "KpiHistory_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "analytics"."GeneratedReport" (    "id" TEXT NOT NULL,    "reportType" "analytics"."ReportType" NOT NULL,    "title" TEXT NOT NULL,    "scope" TEXT NOT NULL,    "scopeId" TEXT,    "period" TEXT,    "academicYearId" TEXT,    "termId" TEXT,    "generatedById" TEXT NOT NULL,    "generatedByRole" TEXT NOT NULL,    "parameters" JSONB NOT NULL,    "pdfUrl" TEXT,    "rowCount" INTEGER,    "status" "analytics"."ReportStatus" NOT NULL DEFAULT 'GENERATING',    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "completedAt" TIMESTAMP(3),    CONSTRAINT "GeneratedReport_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "analytics"."MetricEvent" (    "id" TEXT NOT NULL,    "eventType" TEXT NOT NULL,    "sourceService" TEXT NOT NULL,    "payload" JSONB NOT NULL,    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    CONSTRAINT "MetricEvent_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "students"."Student" (    "id" TEXT NOT NULL,    "registrationNumber" TEXT NOT NULL,    "firstName" TEXT NOT NULL,    "lastName" TEXT NOT NULL,    "gender" TEXT NOT NULL,    "status" TEXT NOT NULL,    "admissionDate" TIMESTAMP(3) NOT NULL,    "dateOfBirth" TIMESTAMP(3) NOT NULL,    "nationality" TEXT NOT NULL,    "profilePhotoUrl" TEXT,    CONSTRAINT "Student_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "students"."Enrolment" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "classId" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "termId" TEXT,    "isActive" BOOLEAN NOT NULL,    CONSTRAINT "Enrolment_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "students"."Class" (    "id" TEXT NOT NULL,    "name" TEXT NOT NULL,    "level" INTEGER NOT NULL,    "stream" TEXT,    "academicYearId" TEXT NOT NULL,    "classTeacherId" TEXT,    "capacity" INTEGER NOT NULL,    CONSTRAINT "Class_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "students"."AcademicYear" (    "id" TEXT NOT NULL,    "name" TEXT NOT NULL,    "isCurrent" BOOLEAN NOT NULL,    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "students"."Term" (    "id" TEXT NOT NULL,    "name" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "isCurrent" BOOLEAN NOT NULL,    CONSTRAINT "Term_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "students"."AttendanceRecord" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "classId" TEXT NOT NULL,    "termId" TEXT NOT NULL,    "date" TIMESTAMP(3) NOT NULL,    "status" TEXT NOT NULL,    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "students"."DisciplineRecord" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "category" TEXT NOT NULL,    "severity" TEXT NOT NULL,    "incidentDate" TIMESTAMP(3) NOT NULL,    "actionTaken" TEXT NOT NULL,    "resolvedAt" TIMESTAMP(3),    CONSTRAINT "DisciplineRecord_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "students"."PerformanceSnapshot" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "subjectId" TEXT NOT NULL,    "subjectName" TEXT NOT NULL,    "termId" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "score" DOUBLE PRECISION NOT NULL,    "grade" TEXT NOT NULL,    "rank" INTEGER,    "totalStudentsInClass" INTEGER,    "teacherId" TEXT NOT NULL,    CONSTRAINT "PerformanceSnapshot_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "students"."PerformanceTrend" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "subjectId" TEXT NOT NULL,    "subjectName" TEXT NOT NULL,    "currentScore" DOUBLE PRECISION NOT NULL,    "averageScore" DOUBLE PRECISION NOT NULL,    "trendDirection" TEXT NOT NULL,    "trendSlope" DOUBLE PRECISION,    "consecutiveDeclines" INTEGER NOT NULL,    "consecutiveImprovements" INTEGER NOT NULL,    "termCount" INTEGER NOT NULL,    CONSTRAINT "PerformanceTrend_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "students"."PerformanceAlert" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "subjectId" TEXT NOT NULL,    "subjectName" TEXT NOT NULL,    "alertType" TEXT NOT NULL,    "severity" TEXT NOT NULL,    "message" TEXT NOT NULL,    "isResolved" BOOLEAN NOT NULL,    "createdAt" TIMESTAMP(3) NOT NULL,    "resolvedAt" TIMESTAMP(3),    CONSTRAINT "PerformanceAlert_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "students"."PeerPairing" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "peerId" TEXT NOT NULL,    "subjectId" TEXT NOT NULL,    "subjectName" TEXT NOT NULL,    "status" TEXT NOT NULL,    "reason" TEXT NOT NULL,    "studentScoreAtPairing" DOUBLE PRECISION NOT NULL,    "peerScoreAtPairing" DOUBLE PRECISION NOT NULL,    "outcomeScore" DOUBLE PRECISION,    "outcomeDelta" DOUBLE PRECISION,    "createdAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "PeerPairing_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "students"."StudentGuardianLink" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "guardianId" TEXT NOT NULL,    "isPrimary" BOOLEAN NOT NULL,    CONSTRAINT "StudentGuardianLink_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."Subject" (    "id" TEXT NOT NULL,    "name" TEXT NOT NULL,    "code" TEXT NOT NULL,    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."ClassSubject" (    "id" TEXT NOT NULL,    "classId" TEXT NOT NULL,    "subjectId" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "teacherId" TEXT NOT NULL,    CONSTRAINT "ClassSubject_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."TermResult" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "classSubjectId" TEXT NOT NULL,    "subjectId" TEXT NOT NULL,    "subjectName" TEXT NOT NULL,    "termId" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "weightedTotal" DOUBLE PRECISION NOT NULL,    "grade" TEXT NOT NULL,    "gradePoints" DOUBLE PRECISION NOT NULL,    "isPassing" BOOLEAN NOT NULL,    "rank" INTEGER,    "totalStudentsInClass" INTEGER,    "isPublished" BOOLEAN NOT NULL,    CONSTRAINT "TermResult_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."ReportCard" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "classId" TEXT NOT NULL,    "termId" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "overallAverage" DOUBLE PRECISION NOT NULL,    "overallGrade" TEXT NOT NULL,    "rank" INTEGER,    "totalStudentsInClass" INTEGER,    "subjectCount" INTEGER NOT NULL,    "failingSubjectCount" INTEGER NOT NULL,    "isPublished" BOOLEAN NOT NULL,    CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."Assessment" (    "id" TEXT NOT NULL,    "classSubjectId" TEXT NOT NULL,    "assessmentTypeId" TEXT NOT NULL,    "termId" TEXT NOT NULL,    "status" TEXT NOT NULL,    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."SyllabusTracker" (    "id" TEXT NOT NULL,    "classSubjectId" TEXT NOT NULL,    "termId" TEXT NOT NULL,    "completionPercentage" DOUBLE PRECISION NOT NULL,    CONSTRAINT "SyllabusTracker_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."AcademicIntervention" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "subjectId" TEXT,    "type" TEXT NOT NULL,    "performedById" TEXT NOT NULL,    "performedByRole" TEXT NOT NULL,    "createdAt" TIMESTAMP(3) NOT NULL,    "isFollowedUp" BOOLEAN NOT NULL,    "note" TEXT NOT NULL,    "outcome" TEXT,    "followUpDate" TIMESTAMP(3),    CONSTRAINT "AcademicIntervention_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "finance"."Invoice" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "classId" TEXT NOT NULL,    "termId" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "invoiceNumber" TEXT NOT NULL,    "totalAmount" DECIMAL(12,2) NOT NULL,    "paidAmount" DECIMAL(12,2) NOT NULL,    "outstandingBalance" DECIMAL(12,2) NOT NULL,    "status" TEXT NOT NULL,    "dueDate" TIMESTAMP(3) NOT NULL,    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "finance"."Payment" (    "id" TEXT NOT NULL,    "invoiceId" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "amount" DECIMAL(12,2) NOT NULL,    "method" TEXT NOT NULL,    "status" TEXT NOT NULL,    "confirmedAt" TIMESTAMP(3),    "paidAt" TIMESTAMP(3),    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "finance"."FeeCategory" (    "id" TEXT NOT NULL,    "name" TEXT NOT NULL,    "code" TEXT NOT NULL,    "isOptional" BOOLEAN NOT NULL,    CONSTRAINT "FeeCategory_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "finance"."Receipt" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "paymentId" TEXT NOT NULL,    "amount" DECIMAL(12,2) NOT NULL,    "method" TEXT NOT NULL,    "issuedAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "notifications"."Notification" (    "id" TEXT NOT NULL,    "recipientId" TEXT NOT NULL,    "channel" TEXT NOT NULL,    "eventType" TEXT NOT NULL,    "status" TEXT NOT NULL,    "createdAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "notifications"."Announcement" (    "id" TEXT NOT NULL,    "title" TEXT NOT NULL,    "status" TEXT NOT NULL,    "publishedAt" TIMESTAMP(3),    "targetRoles" TEXT[],    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id"));

-- CreateIndex
CREATE INDEX "DashboardSnapshot_snapshotType_scope_idx" ON "analytics"."DashboardSnapshot"("snapshotType", "scope");

-- CreateIndex
CREATE INDEX "DashboardSnapshot_expiresAt_idx" ON "analytics"."DashboardSnapshot"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardSnapshot_snapshotType_scope_scopeId_period_key" ON "analytics"."DashboardSnapshot"("snapshotType", "scope", "scopeId", "period");

-- CreateIndex
CREATE INDEX "KpiHistory_kpiName_scope_idx" ON "analytics"."KpiHistory"("kpiName", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "KpiHistory_kpiName_scope_period_key" ON "analytics"."KpiHistory"("kpiName", "scope", "period");

-- CreateIndex
CREATE INDEX "GeneratedReport_reportType_createdAt_idx" ON "analytics"."GeneratedReport"("reportType", "createdAt");

-- CreateIndex
CREATE INDEX "GeneratedReport_generatedById_idx" ON "analytics"."GeneratedReport"("generatedById");

-- CreateIndex
CREATE INDEX "MetricEvent_eventType_processedAt_idx" ON "analytics"."MetricEvent"("eventType", "processedAt");