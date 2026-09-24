-- Classes are unique per school (not globally), so different schools can have
-- identically named classes (e.g. every school has a "Form 1 A").
DROP INDEX IF EXISTS "students"."Class_name_stream_academicYearId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Class_schoolId_name_stream_academicYearId_key"
  ON "students"."Class" ("schoolId", "name", "stream", "academicYearId");
