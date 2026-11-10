-- School-scoped report-card rules. This migration is additive and does not
-- modify marks, results, report cards or publication state.
CREATE TABLE "academics"."ReportCardPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "primaryPassMark" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "oLevelPassMark" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "aLevelPassMark" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "showSubjectSupport" BOOLEAN NOT NULL DEFAULT true,
    "hideExemptSubjects" BOOLEAN NOT NULL DEFAULT true,
    "autoAlternativeSubjectExemptions" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCardPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportCardPolicy_schoolId_key"
  ON "academics"."ReportCardPolicy"("schoolId");
