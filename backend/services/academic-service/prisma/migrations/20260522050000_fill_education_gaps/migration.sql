-- ============================================================
-- Migration: fill_education_gaps
-- Covers Gaps 4, 5, 7 (A-Level subject roles, timetable
-- combination awareness, report-card holistic fields)
-- ============================================================

-- Gap 4 ── SubjectRole enum replaces the boolean isPrincipal
-- -------------------------------------------------------
CREATE TYPE "academics"."SubjectRole" AS ENUM (
  'PRINCIPAL',
  'SUBSIDIARY',
  'COMPULSORY_SUBSIDIARY'
);

ALTER TABLE "academics"."SubjectCombinationSubject"
  ADD COLUMN "subjectRole" "academics"."SubjectRole" NOT NULL DEFAULT 'PRINCIPAL';

-- Migrate existing boolean: isPrincipal=false → SUBSIDIARY
UPDATE "academics"."SubjectCombinationSubject"
  SET "subjectRole" = 'SUBSIDIARY'
  WHERE "isPrincipal" = false;

-- Gap 5 ── Timetable: combination-aware scheduling
-- -------------------------------------------------------
ALTER TABLE "academics"."Timetable"
  ADD COLUMN "combinationId" TEXT;

-- Drop old unique constraint that did not include combinationId
ALTER TABLE "academics"."Timetable"
  DROP CONSTRAINT IF EXISTS "Timetable_classId_dayOfWeek_startTime_termId_key";

-- New constraint: combination (NULL = whole-class slot)
CREATE UNIQUE INDEX "Timetable_class_combo_day_start_term_key"
  ON "academics"."Timetable"("classId", "dayOfWeek", "startTime", "termId")
  WHERE "combinationId" IS NULL;

CREATE UNIQUE INDEX "Timetable_class_combo_specific_day_start_term_key"
  ON "academics"."Timetable"("classId", "combinationId", "dayOfWeek", "startTime", "termId")
  WHERE "combinationId" IS NOT NULL;

CREATE INDEX "Timetable_combinationId_idx" ON "academics"."Timetable"("combinationId");

-- Gap 12 ── ReportCard: Primary holistic assessment columns
-- -------------------------------------------------------
ALTER TABLE "academics"."ReportCard"
  ADD COLUMN "behaviourGrade"     TEXT,
  ADD COLUMN "socialSkillsGrade"  TEXT,
  ADD COLUMN "extraCurricularNote" TEXT,
  ADD COLUMN "readingAbility"     TEXT,
  ADD COLUMN "writingAbility"     TEXT,
  ADD COLUMN "numeracyAbility"    TEXT;
