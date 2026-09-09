CREATE SCHEMA IF NOT EXISTS "analytics";

CREATE TYPE "analytics"."ReportType" AS ENUM (
  'SCHOOL_OVERVIEW',
  'CLASS_ACADEMIC',
  'STUDENT_PROFILE',
  'FINANCE_COLLECTION',
  'OUTSTANDING_BALANCES',
  'PERFORMANCE_ENGINE',
  'ATTENDANCE_SUMMARY',
  'TEACHER_PERFORMANCE',
  'TERM_SUMMARY',
  'ANNUAL_SUMMARY',
  'BOARD_EXECUTIVE',
  'CUSTOM'
);

CREATE TYPE "analytics"."ReportStatus" AS ENUM (
  'GENERATING',
  'READY',
  'FAILED'
);

CREATE TABLE "analytics"."DashboardSnapshot" (
  "id" TEXT NOT NULL,
  "snapshotType" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "scopeId" TEXT,
  "period" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DashboardSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics"."KpiHistory" (
  "id" TEXT NOT NULL,
  "kpiName" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "period" TEXT NOT NULL,
  "academicYearId" TEXT,
  "termId" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KpiHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics"."GeneratedReport" (
  "id" TEXT NOT NULL,
  "reportType" "analytics"."ReportType" NOT NULL,
  "title" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "scopeId" TEXT,
  "period" TEXT,
  "academicYearId" TEXT,
  "termId" TEXT,
  "generatedById" TEXT NOT NULL,
  "generatedByRole" TEXT NOT NULL,
  "parameters" JSONB NOT NULL,
  "pdfUrl" TEXT,
  "rowCount" INTEGER,
  "status" "analytics"."ReportStatus" NOT NULL DEFAULT 'GENERATING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "GeneratedReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics"."MetricEvent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "sourceService" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetricEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DashboardSnapshot_snapshotType_scope_idx"
  ON "analytics"."DashboardSnapshot"("snapshotType", "scope");

CREATE INDEX "DashboardSnapshot_expiresAt_idx"
  ON "analytics"."DashboardSnapshot"("expiresAt");

CREATE UNIQUE INDEX "DashboardSnapshot_snapshotType_scope_scopeId_period_key"
  ON "analytics"."DashboardSnapshot"("snapshotType", "scope", "scopeId", "period");

CREATE INDEX "KpiHistory_kpiName_scope_idx"
  ON "analytics"."KpiHistory"("kpiName", "scope");

CREATE UNIQUE INDEX "KpiHistory_kpiName_scope_period_key"
  ON "analytics"."KpiHistory"("kpiName", "scope", "period");

CREATE INDEX "GeneratedReport_reportType_createdAt_idx"
  ON "analytics"."GeneratedReport"("reportType", "createdAt");

CREATE INDEX "GeneratedReport_generatedById_idx"
  ON "analytics"."GeneratedReport"("generatedById");

CREATE INDEX "MetricEvent_eventType_processedAt_idx"
  ON "analytics"."MetricEvent"("eventType", "processedAt");
