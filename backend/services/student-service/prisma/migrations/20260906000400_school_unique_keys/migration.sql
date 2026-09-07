DROP INDEX IF EXISTS "students"."AcademicYear_name_key";
CREATE UNIQUE INDEX "AcademicYear_schoolId_name_key" ON "students"."AcademicYear"("schoolId", "name");
DROP INDEX IF EXISTS "students"."Department_name_key";
CREATE UNIQUE INDEX "Department_schoolId_name_key" ON "students"."Department"("schoolId", "name");
DROP INDEX IF EXISTS "students"."Department_code_key";
CREATE UNIQUE INDEX "Department_schoolId_code_key" ON "students"."Department"("schoolId", "code");
