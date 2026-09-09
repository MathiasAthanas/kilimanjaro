-- Multi-school scoping columns for academic domain

ALTER TABLE "academics"."ClassSubject"   ADD COLUMN "schoolId" TEXT;
ALTER TABLE "academics"."Assessment"     ADD COLUMN "schoolId" TEXT;
ALTER TABLE "academics"."TermResult"     ADD COLUMN "schoolId" TEXT;
ALTER TABLE "academics"."ReportCard"     ADD COLUMN "schoolId" TEXT;
ALTER TABLE "academics"."Timetable"      ADD COLUMN "schoolId" TEXT;
ALTER TABLE "academics"."GradingScale"   ADD COLUMN "schoolId" TEXT;

CREATE INDEX "ClassSubject_schoolId_idx"   ON "academics"."ClassSubject"("schoolId");
CREATE INDEX "Assessment_schoolId_idx"     ON "academics"."Assessment"("schoolId");
CREATE INDEX "TermResult_schoolId_idx"     ON "academics"."TermResult"("schoolId");
CREATE INDEX "ReportCard_schoolId_idx"     ON "academics"."ReportCard"("schoolId");
