-- CreateTable
CREATE TABLE "academics"."ReportCardComposition" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "name" TEXT,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "scopeLevel" INTEGER,
    "scopeClassIds" TEXT[],
    "windowSelections" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "classesGenerated" INTEGER NOT NULL DEFAULT 0,
    "studentsGenerated" INTEGER NOT NULL DEFAULT 0,
    "reportCardsGenerated" INTEGER NOT NULL DEFAULT 0,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCardComposition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportCardComposition_schoolId_termId_idx" ON "academics"."ReportCardComposition"("schoolId", "termId");

-- CreateIndex
CREATE INDEX "ReportCardComposition_academicYearId_termId_idx" ON "academics"."ReportCardComposition"("academicYearId", "termId");

