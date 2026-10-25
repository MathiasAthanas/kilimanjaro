-- Follow-up log for families who owe fees (who was contacted, how, what they promised).
CREATE TABLE IF NOT EXISTS "finance"."DefaulterContact" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONTACTED',
    "method" TEXT NOT NULL DEFAULT 'OTHER',
    "note" TEXT NOT NULL,
    "followUpDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdByLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DefaulterContact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DefaulterContact_schoolId_createdAt_idx" ON "finance"."DefaulterContact"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "DefaulterContact_studentId_createdAt_idx" ON "finance"."DefaulterContact"("studentId", "createdAt");
