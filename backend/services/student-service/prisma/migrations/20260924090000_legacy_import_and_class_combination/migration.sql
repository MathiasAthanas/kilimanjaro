-- Legacy import support + A-Level class combination linkage

-- Student: DOB nullable, add legacy admission number
ALTER TABLE "students"."Student" ALTER COLUMN "dateOfBirth" DROP NOT NULL;
ALTER TABLE "students"."Student" ADD COLUMN IF NOT EXISTS "legacyAdmissionNumber" TEXT;

-- Class: attach an A-Level subject combination
ALTER TABLE "students"."Class" ADD COLUMN IF NOT EXISTS "combinationCode" TEXT;
ALTER TABLE "students"."Class" ADD COLUMN IF NOT EXISTS "combinationId" TEXT;

-- Lookup index for legacy admission numbers within a school
CREATE INDEX IF NOT EXISTS "Student_schoolId_legacyAdmissionNumber_idx"
  ON "students"."Student" ("schoolId", "legacyAdmissionNumber");
