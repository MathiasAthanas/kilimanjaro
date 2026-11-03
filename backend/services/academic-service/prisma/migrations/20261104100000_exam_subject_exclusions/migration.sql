-- Additive: subjects omitted from an exam window (or by a standing school rule).
ALTER TABLE "academics"."ExamWindow" ADD COLUMN IF NOT EXISTS "subjectsChangedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "academics"."ExamSubjectExclusion" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "examWindowId" TEXT,
  "subjectId" TEXT NOT NULL,
  "classId" TEXT,
  "reason" TEXT NOT NULL,
  "discardedMarks" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamSubjectExclusion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExamSubjectExclusion_examWindowId_idx" ON "academics"."ExamSubjectExclusion"("examWindowId");
CREATE INDEX IF NOT EXISTS "ExamSubjectExclusion_schoolId_subjectId_idx" ON "academics"."ExamSubjectExclusion"("schoolId", "subjectId");

ALTER TABLE "academics"."ExamSubjectExclusion"
  ADD CONSTRAINT "ExamSubjectExclusion_examWindowId_fkey"
  FOREIGN KEY ("examWindowId") REFERENCES "academics"."ExamWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
