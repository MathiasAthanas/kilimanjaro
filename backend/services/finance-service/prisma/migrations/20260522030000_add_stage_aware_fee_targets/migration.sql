-- CreateEnum
CREATE TYPE "finance"."EducationStage" AS ENUM ('PRIMARY', 'O_LEVEL', 'A_LEVEL');

-- AlterTable
ALTER TABLE "finance"."FeeStructure"
  ADD COLUMN "educationStage" "finance"."EducationStage",
  ADD COLUMN "studentGroup" TEXT;

-- AlterTable
ALTER TABLE "finance"."Invoice"
  ADD COLUMN "educationStage" "finance"."EducationStage",
  ADD COLUMN "classLevel" INTEGER;

-- AlterTable
ALTER TABLE "finance"."Receipt"
  ADD COLUMN "educationStage" "finance"."EducationStage",
  ADD COLUMN "classLevel" INTEGER;

-- DropIndex
DROP INDEX IF EXISTS "finance"."FeeStructure_classLevel_termId_academicYearId_idx";

-- CreateIndex
CREATE INDEX "FeeStructure_educationStage_classLevel_termId_academicYearId_idx" ON "finance"."FeeStructure"("educationStage", "classLevel", "termId", "academicYearId");

-- CreateIndex
CREATE INDEX "FeeStructure_studentGroup_termId_academicYearId_idx" ON "finance"."FeeStructure"("studentGroup", "termId", "academicYearId");
