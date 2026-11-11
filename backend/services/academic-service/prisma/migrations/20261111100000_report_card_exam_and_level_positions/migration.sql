ALTER TABLE "academics"."ReportCard"
ADD COLUMN "overallRank" INTEGER,
ADD COLUMN "totalStudentsInLevel" INTEGER,
ADD COLUMN "examLabel" TEXT;

CREATE INDEX "ReportCard_schoolId_termId_educationStage_classLevel_idx"
ON "academics"."ReportCard"("schoolId", "termId", "educationStage", "classLevel");
