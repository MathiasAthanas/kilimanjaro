-- Additive migration: result calculation exemptions, NOT_SAT marks, and
-- per-subject status / eligibility metadata. Nothing here recalculates or
-- rewrites existing results; existing rows only change when an authorized user
-- explicitly recomputes.

-- CreateEnum
CREATE TYPE "academics"."ExemptionScope" AS ENUM ('STUDENT', 'CLASS');
CREATE TYPE "academics"."ExemptionStatus" AS ENUM ('APPROVED', 'REVOKED');

-- AlterTable
ALTER TABLE "academics"."Mark" ADD COLUMN "notSat" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "academics"."TermResult" ADD COLUMN "resultStatus" TEXT NOT NULL DEFAULT 'SCORED';
ALTER TABLE "academics"."ReportCard"
  ADD COLUMN "subjectsExpected" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "exemptSubjectCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "academics"."ExamWindowResult"
  ADD COLUMN "subjectsExpected" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "subjectsAssessed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "division" TEXT,
  ADD COLUMN "divisionPoints" DOUBLE PRECISION,
  ADD COLUMN "divisionNote" TEXT;

-- CreateTable
CREATE TABLE "academics"."ResultCalculationExemption" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "examWindowId" TEXT,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "studentId" TEXT,
    "scope" "academics"."ExemptionScope" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "academics"."ExemptionStatus" NOT NULL DEFAULT 'APPROVED',
    "createdById" TEXT NOT NULL,
    "createdByRole" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultCalculationExemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResultCalculationExemption_schoolId_termId_status_idx" ON "academics"."ResultCalculationExemption"("schoolId", "termId", "status");
CREATE INDEX "ResultCalculationExemption_classId_subjectId_termId_idx" ON "academics"."ResultCalculationExemption"("classId", "subjectId", "termId");
CREATE INDEX "ResultCalculationExemption_studentId_termId_idx" ON "academics"."ResultCalculationExemption"("studentId", "termId");
CREATE INDEX "ResultCalculationExemption_examWindowId_idx" ON "academics"."ResultCalculationExemption"("examWindowId");

ALTER TABLE "academics"."ResultCalculationExemption"
  ADD CONSTRAINT "ResultCalculationExemption_examWindowId_fkey"
  FOREIGN KEY ("examWindowId") REFERENCES "academics"."ExamWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
