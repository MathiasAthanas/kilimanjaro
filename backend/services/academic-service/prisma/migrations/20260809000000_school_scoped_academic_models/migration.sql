-- School-scoping columns for previously unscoped academic models

-- SubjectCombination: add schoolId so each school can define its own A-Level combinations.
-- Replace the old unique(code, academicYearId) with a COALESCE-based index so NULL schoolId
-- represents a group-wide (shared) combination and school-specific ones can coexist.
ALTER TABLE "academics"."SubjectCombination" ADD COLUMN "schoolId" TEXT;
DROP INDEX IF EXISTS "academics"."SubjectCombination_code_academicYearId_key";
CREATE UNIQUE INDEX "SubjectCombination_code_academicYearId_schoolId_key"
  ON "academics"."SubjectCombination" ("code", "academicYearId", COALESCE("schoolId", ''));
CREATE INDEX "SubjectCombination_code_academicYearId_schoolId_idx"
  ON "academics"."SubjectCombination" ("code", "academicYearId", "schoolId");

-- AcademicIntervention: add schoolId so per-school interventions are properly scoped.
ALTER TABLE "academics"."AcademicIntervention" ADD COLUMN "schoolId" TEXT;
CREATE INDEX "AcademicIntervention_schoolId_idx" ON "academics"."AcademicIntervention" ("schoolId");

-- AcademicAuditLog: add schoolId so audit trail queries can be filtered per school.
ALTER TABLE "academics"."AcademicAuditLog" ADD COLUMN "schoolId" TEXT;
CREATE INDEX "AcademicAuditLog_schoolId_idx" ON "academics"."AcademicAuditLog" ("schoolId");
