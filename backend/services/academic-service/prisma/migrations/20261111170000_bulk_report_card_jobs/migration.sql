CREATE TABLE IF NOT EXISTS "academics"."BulkReportCardJob" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedByRole" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "classId" TEXT,
    "educationStage" TEXT,
    "classLevel" INTEGER,
    "termId" TEXT NOT NULL,
    "examLabel" TEXT,
    "format" TEXT NOT NULL,
    "includeClassName" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "fileName" TEXT,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkReportCardJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BulkReportCardJob_schoolId_createdAt_idx"
    ON "academics"."BulkReportCardJob"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "BulkReportCardJob_requestedById_status_idx"
    ON "academics"."BulkReportCardJob"("requestedById", "status");
CREATE INDEX IF NOT EXISTS "BulkReportCardJob_status_expiresAt_idx"
    ON "academics"."BulkReportCardJob"("status", "expiresAt");
