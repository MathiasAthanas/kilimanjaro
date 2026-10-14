-- Departments are school-owned. Existing NULL-school rows remain group templates.
-- No department, HOD assignment, user, or student data is removed by this migration.

ALTER TABLE "students"."DepartmentHod"
  ADD COLUMN IF NOT EXISTS "schoolId" TEXT;

UPDATE "students"."DepartmentHod" AS hod
SET "schoolId" = department."schoolId"
FROM "students"."Department" AS department
WHERE department."id" = hod."departmentId"
  AND hod."schoolId" IS NULL;

DROP INDEX IF EXISTS "students"."Department_name_key";
DROP INDEX IF EXISTS "students"."Department_code_key";

-- PostgreSQL treats NULL values as distinct in normal unique indexes. COALESCE
-- makes the shared/global catalogue one namespace and each school another.
CREATE UNIQUE INDEX IF NOT EXISTS "Department_schoolId_name_key"
  ON "students"."Department" (COALESCE("schoolId", '__group__'), "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Department_schoolId_code_key"
  ON "students"."Department" (COALESCE("schoolId", '__group__'), "code");

CREATE INDEX IF NOT EXISTS "Department_schoolId_name_idx"
  ON "students"."Department" ("schoolId", "name");
CREATE INDEX IF NOT EXISTS "Department_schoolId_code_idx"
  ON "students"."Department" ("schoolId", "code");
CREATE INDEX IF NOT EXISTS "DepartmentHod_schoolId_userId_isActive_idx"
  ON "students"."DepartmentHod" ("schoolId", "userId", "isActive");
CREATE INDEX IF NOT EXISTS "DepartmentHod_schoolId_departmentId_isActive_idx"
  ON "students"."DepartmentHod" ("schoolId", "departmentId", "isActive");
