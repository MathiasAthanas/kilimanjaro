-- Audit rows belong to the school of the record they describe, so a school's finance staff only see their own trail.
-- Rows that cannot be traced to a school stay NULL and are visible to group-level roles only.
ALTER TABLE "finance"."FinancialAuditLog" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
CREATE INDEX IF NOT EXISTS "FinancialAuditLog_schoolId_createdAt_idx" ON "finance"."FinancialAuditLog"("schoolId", "createdAt");

UPDATE "finance"."FinancialAuditLog"
SET "schoolId" = COALESCE("newValue"->>'schoolId', "previousValue"->>'schoolId')
WHERE "schoolId" IS NULL;
