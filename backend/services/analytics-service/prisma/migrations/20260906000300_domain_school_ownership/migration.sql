-- Additive backfill; application middleware sets schoolId on every new write.
ALTER TABLE "analytics"."DashboardSnapshot" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "DashboardSnapshot_schoolId_idx" ON "analytics"."DashboardSnapshot"("schoolId");
ALTER TABLE "analytics"."KpiHistory" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "KpiHistory_schoolId_idx" ON "analytics"."KpiHistory"("schoolId");
ALTER TABLE "analytics"."GeneratedReport" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "GeneratedReport_schoolId_idx" ON "analytics"."GeneratedReport"("schoolId");
ALTER TABLE "analytics"."MetricEvent" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "MetricEvent_schoolId_idx" ON "analytics"."MetricEvent"("schoolId");
