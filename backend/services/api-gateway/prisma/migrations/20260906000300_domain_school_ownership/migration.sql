-- Additive backfill; application middleware sets schoolId on every new write.
ALTER TABLE "operations"."operation_records" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "operation_records_schoolId_idx" ON "operations"."operation_records"("schoolId");

UPDATE operations.operation_records SET collection = "schoolId" || ':' || collection WHERE collection NOT LIKE "schoolId" || ':%';
