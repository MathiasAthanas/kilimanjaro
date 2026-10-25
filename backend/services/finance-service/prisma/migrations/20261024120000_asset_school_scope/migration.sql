-- Fixed assets belong to a school. Existing rows stay NULL, meaning shared across the group.
ALTER TABLE "finance"."Asset" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
CREATE INDEX IF NOT EXISTS "Asset_schoolId_idx" ON "finance"."Asset"("schoolId");
