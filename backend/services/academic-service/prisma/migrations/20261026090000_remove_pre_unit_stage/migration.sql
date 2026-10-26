-- Pre-Unit is not a standalone stage. Do not silently reinterpret academic
-- records: the migration must be stopped and reviewed if old values exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM academics."Assessment" WHERE "educationStage"::text = 'PRE_UNIT')
     OR EXISTS (SELECT 1 FROM academics."AssessmentType" WHERE "educationStage"::text = 'PRE_UNIT')
     OR EXISTS (SELECT 1 FROM academics."ClassSubject" WHERE "educationStage"::text = 'PRE_UNIT')
     OR EXISTS (SELECT 1 FROM academics."ExamType" WHERE "educationStage"::text = 'PRE_UNIT')
     OR EXISTS (SELECT 1 FROM academics."ExamWindow" WHERE "educationStage"::text = 'PRE_UNIT')
     OR EXISTS (SELECT 1 FROM academics."ExamWindowResult" WHERE "educationStage"::text = 'PRE_UNIT')
     OR EXISTS (SELECT 1 FROM academics."GradingScale" WHERE "educationStage"::text = 'PRE_UNIT')
     OR EXISTS (SELECT 1 FROM academics."ReportCard" WHERE "educationStage"::text = 'PRE_UNIT')
     OR EXISTS (SELECT 1 FROM academics."Subject" WHERE "educationStage"::text = 'PRE_UNIT')
     OR EXISTS (SELECT 1 FROM academics."SubjectCombination" WHERE "educationStage"::text = 'PRE_UNIT')
     OR EXISTS (SELECT 1 FROM academics."TermResult" WHERE "educationStage"::text = 'PRE_UNIT') THEN
    RAISE EXCEPTION 'PRE_UNIT data exists. Migrate it to Nursery deliberately before removing the enum value.';
  END IF;
END $$;

ALTER TYPE academics."EducationStage" RENAME TO "EducationStage_old";
CREATE TYPE academics."EducationStage" AS ENUM ('NURSERY', 'PRIMARY', 'O_LEVEL', 'A_LEVEL');

ALTER TABLE academics."Subject"
  ALTER COLUMN "educationStage" TYPE academics."EducationStage"
    USING "educationStage"::text::academics."EducationStage";
ALTER TABLE academics."ClassSubject"
  ALTER COLUMN "educationStage" DROP DEFAULT,
  ALTER COLUMN "educationStage" TYPE academics."EducationStage"
    USING "educationStage"::text::academics."EducationStage",
  ALTER COLUMN "educationStage" SET DEFAULT 'O_LEVEL'::academics."EducationStage";
ALTER TABLE academics."GradingScale"
  ALTER COLUMN "educationStage" TYPE academics."EducationStage"
    USING "educationStage"::text::academics."EducationStage";
ALTER TABLE academics."AssessmentType"
  ALTER COLUMN "educationStage" TYPE academics."EducationStage"
    USING "educationStage"::text::academics."EducationStage";
ALTER TABLE academics."Assessment"
  ALTER COLUMN "educationStage" DROP DEFAULT,
  ALTER COLUMN "educationStage" TYPE academics."EducationStage"
    USING "educationStage"::text::academics."EducationStage",
  ALTER COLUMN "educationStage" SET DEFAULT 'O_LEVEL'::academics."EducationStage";
ALTER TABLE academics."TermResult"
  ALTER COLUMN "educationStage" DROP DEFAULT,
  ALTER COLUMN "educationStage" TYPE academics."EducationStage"
    USING "educationStage"::text::academics."EducationStage",
  ALTER COLUMN "educationStage" SET DEFAULT 'O_LEVEL'::academics."EducationStage";
ALTER TABLE academics."ReportCard"
  ALTER COLUMN "educationStage" DROP DEFAULT,
  ALTER COLUMN "educationStage" TYPE academics."EducationStage"
    USING "educationStage"::text::academics."EducationStage",
  ALTER COLUMN "educationStage" SET DEFAULT 'O_LEVEL'::academics."EducationStage";
ALTER TABLE academics."SubjectCombination"
  ALTER COLUMN "educationStage" DROP DEFAULT,
  ALTER COLUMN "educationStage" TYPE academics."EducationStage"
    USING "educationStage"::text::academics."EducationStage",
  ALTER COLUMN "educationStage" SET DEFAULT 'A_LEVEL'::academics."EducationStage";
ALTER TABLE academics."ExamType"
  ALTER COLUMN "educationStage" TYPE academics."EducationStage"
    USING "educationStage"::text::academics."EducationStage";
ALTER TABLE academics."ExamWindow"
  ALTER COLUMN "educationStage" TYPE academics."EducationStage"
    USING "educationStage"::text::academics."EducationStage";
ALTER TABLE academics."ExamWindowResult"
  ALTER COLUMN "educationStage" DROP DEFAULT,
  ALTER COLUMN "educationStage" TYPE academics."EducationStage"
    USING "educationStage"::text::academics."EducationStage",
  ALTER COLUMN "educationStage" SET DEFAULT 'PRIMARY'::academics."EducationStage";

DROP TYPE academics."EducationStage_old";
