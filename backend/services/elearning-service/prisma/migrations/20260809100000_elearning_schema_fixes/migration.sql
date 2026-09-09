-- Add termName and academicYearName for display without service calls
ALTER TABLE "elearning"."course_spaces" ADD COLUMN IF NOT EXISTS "termName" TEXT;
ALTER TABLE "elearning"."course_spaces" ADD COLUMN IF NOT EXISTS "academicYearName" TEXT;

-- Add audience to announcements
ALTER TABLE "elearning"."course_announcements" ADD COLUMN IF NOT EXISTS "audience" TEXT NOT NULL DEFAULT 'ALL';

-- Migrate CourseEnrollment.status from plain String to typed enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EnrollmentStatus' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'elearning')) THEN
    CREATE TYPE "elearning"."EnrollmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DROPPED');
  END IF;
END $$;

-- Drop default, cast column, re-add typed default
ALTER TABLE "elearning"."course_enrollments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "elearning"."course_enrollments"
  ALTER COLUMN "status" TYPE "elearning"."EnrollmentStatus"
  USING "status"::"elearning"."EnrollmentStatus";
ALTER TABLE "elearning"."course_enrollments"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"elearning"."EnrollmentStatus";

-- Add FK relation for QuizAttempt.courseSpaceId
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'elearning' AND table_name = 'quiz_attempts'
    AND constraint_name = 'quiz_attempts_courseSpaceId_fkey'
  ) THEN
    ALTER TABLE "elearning"."quiz_attempts"
      ADD CONSTRAINT "quiz_attempts_courseSpaceId_fkey"
      FOREIGN KEY ("courseSpaceId") REFERENCES "elearning"."course_spaces"("id") ON DELETE CASCADE;
  END IF;
END $$;
