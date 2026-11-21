-- Residence classification history (additive). Existing students and rows are untouched.
DO $$ BEGIN
  CREATE TYPE students."ResidenceChangeStatus" AS ENUM ('SCHEDULED', 'APPLIED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS students."ResidenceChange" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolId" TEXT,
  "fromType" students."ResidenceType",
  "toType" students."ResidenceType" NOT NULL,
  "status" students."ResidenceChangeStatus" NOT NULL DEFAULT 'APPLIED',
  "effectiveTermId" TEXT,
  "effectiveFrom" TIMESTAMP(3),
  "reason" TEXT,
  "releasedDormitoryId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'CHANGE',
  "changedBy" TEXT NOT NULL,
  "changedByRole" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" TIMESTAMP(3),
  CONSTRAINT "ResidenceChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ResidenceChange_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES students."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ResidenceChange_studentId_createdAt_idx" ON students."ResidenceChange"("studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "ResidenceChange_status_effectiveFrom_idx" ON students."ResidenceChange"("status", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "ResidenceChange_schoolId_createdAt_idx" ON students."ResidenceChange"("schoolId", "createdAt");
