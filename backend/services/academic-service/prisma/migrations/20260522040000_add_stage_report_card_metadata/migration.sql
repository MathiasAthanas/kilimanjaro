ALTER TABLE "academics"."ReportCard"
  ADD COLUMN "reportTemplateCode" TEXT,
  ADD COLUMN "divisionSummary" JSONB;

CREATE INDEX "ReportCard_reportTemplateCode_termId_idx" ON "academics"."ReportCard"("reportTemplateCode", "termId");
