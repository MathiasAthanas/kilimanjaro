-- ============================================================
-- Migration: fill_student_education_gaps
-- Covers Gaps 3, 6, 9 (NECTA identifiers, stage-specific
-- performance thresholds, stage-prefixed registration numbers)
-- ============================================================

-- Gap 3 ── NECTA / national exam identifiers on Student
-- -------------------------------------------------------
ALTER TABLE "students"."Student"
  ADD COLUMN "nectaCandidateNumber" TEXT,
  ADD COLUMN "psleIndexNumber"      TEXT,
  ADD COLUMN "nationalExamYear"     INTEGER;

CREATE INDEX "Student_nectaCandidateNumber_idx"
  ON "students"."Student"("nectaCandidateNumber")
  WHERE "nectaCandidateNumber" IS NOT NULL;

CREATE INDEX "Student_psleIndexNumber_idx"
  ON "students"."Student"("psleIndexNumber")
  WHERE "psleIndexNumber" IS NOT NULL;

-- Gap 9 ── Stage-prefixed registration number sequences
-- -------------------------------------------------------
-- Keep old RegistrationSequence for legacy; add per-stage table
CREATE TABLE "students"."RegistrationSequenceByStage" (
  "year"      INTEGER  NOT NULL,
  "stage"     TEXT     NOT NULL,
  "nextValue" INTEGER  NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegistrationSequenceByStage_pkey" PRIMARY KEY ("year", "stage")
);

-- Gap 6 ── Stage-specific performance thresholds
-- -------------------------------------------------------
ALTER TABLE "students"."PerformanceEngineConfig"
  -- Primary thresholds (pass mark often 50 % in Tanzanian primary)
  ADD COLUMN "primaryFailureThreshold" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
  ADD COLUMN "primaryAtRiskThreshold"  DOUBLE PRECISION NOT NULL DEFAULT 60.0,
  -- A-Level thresholds (E grade = 25 % is minimum pass for ACSEE)
  ADD COLUMN "aLevelFailureThreshold"  DOUBLE PRECISION NOT NULL DEFAULT 25.0,
  ADD COLUMN "aLevelAtRiskThreshold"   DOUBLE PRECISION NOT NULL DEFAULT 35.0;
