-- Fixed assets belong to a school. Existing rows stay NULL, meaning shared across the group.
ALTER TABLE "finance"."Asset" ADD COLUMN "schoolId" TEXT;
CREATE INDEX "Asset_schoolId_idx" ON "finance"."Asset"("schoolId");
