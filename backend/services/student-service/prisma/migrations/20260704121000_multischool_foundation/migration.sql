-- Multi-school foundation: School entity + schoolId scoping columns

CREATE TYPE "students"."SchoolType" AS ENUM ('NURSERY', 'PRIMARY', 'SECONDARY');
CREATE TYPE "students"."SchoolGender" AS ENUM ('MALE', 'FEMALE', 'BOTH');

CREATE TABLE "students"."School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "students"."SchoolType" NOT NULL,
    "gender" "students"."SchoolGender" NOT NULL DEFAULT 'BOTH',
    "motto" TEXT,
    "logoUrl" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "School_code_key" ON "students"."School"("code");

ALTER TABLE "students"."Class"      ADD COLUMN "schoolId" TEXT;
ALTER TABLE "students"."Student"    ADD COLUMN "schoolId" TEXT;
ALTER TABLE "students"."Enrolment"  ADD COLUMN "schoolId" TEXT;
ALTER TABLE "students"."Term"       ADD COLUMN "schoolId" TEXT;
ALTER TABLE "students"."Department" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "students"."Applicant"  ADD COLUMN "schoolId" TEXT;
ALTER TABLE "students"."AttendanceRecord" ADD COLUMN "schoolId" TEXT;

CREATE INDEX "Class_schoolId_idx"     ON "students"."Class"("schoolId");
CREATE INDEX "Student_schoolId_idx"   ON "students"."Student"("schoolId");
CREATE INDEX "Enrolment_schoolId_idx" ON "students"."Enrolment"("schoolId");
CREATE INDEX "Applicant_schoolId_idx" ON "students"."Applicant"("schoolId");

ALTER TABLE "students"."Class"   ADD CONSTRAINT "Class_schoolId_fkey"   FOREIGN KEY ("schoolId") REFERENCES "students"."School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "students"."Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "students"."School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
