-- CreateEnum
CREATE TYPE "elearning"."EducationStage" AS ENUM ('PRIMARY', 'O_LEVEL', 'A_LEVEL');

-- AlterTable
ALTER TABLE "elearning"."course_spaces"
  ADD COLUMN "educationStage" "elearning"."EducationStage" NOT NULL DEFAULT 'O_LEVEL',
  ADD COLUMN "classLevel" INTEGER,
  ADD COLUMN "combinationId" TEXT;

-- CreateIndex
CREATE INDEX "course_spaces_educationStage_classLevel_academicYearId_idx" ON "elearning"."course_spaces"("educationStage", "classLevel", "academicYearId");

-- CreateIndex
CREATE INDEX "course_spaces_combinationId_idx" ON "elearning"."course_spaces"("combinationId");
