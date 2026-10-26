-- Pre-Unit is not a standalone stage. Nursery now contains Baby Class (1),
-- KG 1 (2), and KG 2 (3). Refuse to silently rewrite legacy records.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM students."Class" WHERE "educationStage"::text = 'PRE_UNIT')
     OR EXISTS (SELECT 1 FROM students."Applicant" WHERE "educationStage"::text = 'PRE_UNIT') THEN
    RAISE EXCEPTION 'PRE_UNIT data exists. Migrate it to Nursery deliberately before removing the enum value.';
  END IF;
END $$;

ALTER TYPE students."EducationStage" RENAME TO "EducationStage_old";
CREATE TYPE students."EducationStage" AS ENUM ('NURSERY', 'PRIMARY', 'O_LEVEL', 'A_LEVEL');

ALTER TABLE students."Class"
  ALTER COLUMN "educationStage" DROP DEFAULT,
  ALTER COLUMN "educationStage" TYPE students."EducationStage"
    USING "educationStage"::text::students."EducationStage",
  ALTER COLUMN "educationStage" SET DEFAULT 'O_LEVEL'::students."EducationStage";

ALTER TABLE students."Applicant"
  ALTER COLUMN "educationStage" TYPE students."EducationStage"
    USING "educationStage"::text::students."EducationStage";

DROP TYPE students."EducationStage_old";
