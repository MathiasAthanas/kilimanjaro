-- Assessment types are school-owned. Existing NULL-school rows remain shared
-- templates and are preserved without modification.

ALTER TABLE "academics"."AssessmentType"
  ADD COLUMN IF NOT EXISTS "schoolId" TEXT;

DROP INDEX IF EXISTS "academics"."AssessmentType_code_academicYearId_educationStage_classLeve_key";

-- The template namespace and each school namespace may use the same assessment
-- code and scope. NULLS NOT DISTINCT makes nullable scope dimensions part of
-- the key instead of allowing duplicate NULL combinations.
CREATE UNIQUE INDEX IF NOT EXISTS "AssessmentType_schoolId_code_scope_key"
  ON "academics"."AssessmentType" (
    "schoolId",
    "code",
    "academicYearId",
    "educationStage",
    "classLevel",
    "subjectId"
  ) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS "AssessmentType_school_scope_active_idx"
  ON "academics"."AssessmentType" (
    "schoolId", "academicYearId", "educationStage", "classLevel", "subjectId", "isActive"
  );
CREATE INDEX IF NOT EXISTS "AssessmentType_school_code_year_idx"
  ON "academics"."AssessmentType" ("schoolId", "code", "academicYearId");
