-- CreateEnum
CREATE TYPE "academics"."EducationStage" AS ENUM ('PRIMARY', 'O_LEVEL', 'A_LEVEL');

-- AlterTable
ALTER TABLE "academics"."Subject" ADD COLUMN "educationStage" "academics"."EducationStage";

-- AlterTable
ALTER TABLE "academics"."ClassSubject"
  ADD COLUMN "educationStage" "academics"."EducationStage" NOT NULL DEFAULT 'O_LEVEL',
  ADD COLUMN "classLevel" INTEGER,
  ADD COLUMN "combinationId" TEXT;

-- AlterTable
ALTER TABLE "academics"."GradingScale"
  ADD COLUMN "educationStage" "academics"."EducationStage",
  ADD COLUMN "classLevel" INTEGER,
  ADD COLUMN "subjectId" TEXT;

-- AlterTable
ALTER TABLE "academics"."AssessmentType"
  ADD COLUMN "educationStage" "academics"."EducationStage",
  ADD COLUMN "classLevel" INTEGER,
  ADD COLUMN "subjectId" TEXT;

-- AlterTable
ALTER TABLE "academics"."Assessment"
  ADD COLUMN "educationStage" "academics"."EducationStage" NOT NULL DEFAULT 'O_LEVEL',
  ADD COLUMN "classLevel" INTEGER,
  ADD COLUMN "combinationId" TEXT;

-- AlterTable
ALTER TABLE "academics"."TermResult"
  ADD COLUMN "educationStage" "academics"."EducationStage" NOT NULL DEFAULT 'O_LEVEL',
  ADD COLUMN "classLevel" INTEGER,
  ADD COLUMN "combinationId" TEXT;

-- AlterTable
ALTER TABLE "academics"."ReportCard"
  ADD COLUMN "educationStage" "academics"."EducationStage" NOT NULL DEFAULT 'O_LEVEL',
  ADD COLUMN "classLevel" INTEGER,
  ADD COLUMN "combinationId" TEXT;

-- CreateTable
CREATE TABLE "academics"."SubjectCombination" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "educationStage" "academics"."EducationStage" NOT NULL DEFAULT 'A_LEVEL',
  "academicYearId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubjectCombination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academics"."SubjectCombinationSubject" (
  "id" TEXT NOT NULL,
  "combinationId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "isPrincipal" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SubjectCombinationSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academics"."StudentSubjectEnrollment" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "termId" TEXT,
  "combinationId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentSubjectEnrollment_pkey" PRIMARY KEY ("id")
);

-- DropIndex
DROP INDEX IF EXISTS "academics"."ClassSubject_classId_subjectId_academicYearId_key";

-- DropIndex
DROP INDEX IF EXISTS "academics"."AssessmentType_code_academicYearId_key";

-- DropIndex
DROP INDEX IF EXISTS "academics"."AssessmentType_academicYearId_isActive_idx";

-- DropIndex
DROP INDEX IF EXISTS "academics"."GradingScale_academicYearId_isActive_idx";

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubject_classId_subjectId_academicYearId_combinationId_key" ON "academics"."ClassSubject"("classId", "subjectId", "academicYearId", "combinationId");

-- PostgreSQL treats NULL values as distinct inside ordinary unique indexes. This
-- partial index preserves the original one-class-one-subject rule for non-A-Level
-- rows that do not belong to a subject combination.
CREATE UNIQUE INDEX "ClassSubject_class_subject_year_no_combination_key"
  ON "academics"."ClassSubject"("classId", "subjectId", "academicYearId")
  WHERE "combinationId" IS NULL;

-- CreateIndex
CREATE INDEX "ClassSubject_educationStage_classLevel_academicYearId_idx" ON "academics"."ClassSubject"("educationStage", "classLevel", "academicYearId");

-- CreateIndex
CREATE INDEX "ClassSubject_combinationId_idx" ON "academics"."ClassSubject"("combinationId");

-- CreateIndex
CREATE INDEX "GradingScale_academicYearId_educationStage_classLevel_subjectId_isActive_idx" ON "academics"."GradingScale"("academicYearId", "educationStage", "classLevel", "subjectId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentType_code_academicYearId_educationStage_classLevel_subjectId_key" ON "academics"."AssessmentType"("code", "academicYearId", "educationStage", "classLevel", "subjectId");

-- CreateIndex
CREATE INDEX "AssessmentType_academicYearId_educationStage_classLevel_subjectId_isActive_idx" ON "academics"."AssessmentType"("academicYearId", "educationStage", "classLevel", "subjectId", "isActive");

-- CreateIndex
CREATE INDEX "Assessment_educationStage_classLevel_academicYearId_idx" ON "academics"."Assessment"("educationStage", "classLevel", "academicYearId");

-- CreateIndex
CREATE INDEX "Assessment_combinationId_idx" ON "academics"."Assessment"("combinationId");

-- CreateIndex
CREATE INDEX "TermResult_educationStage_classLevel_termId_idx" ON "academics"."TermResult"("educationStage", "classLevel", "termId");

-- CreateIndex
CREATE INDEX "TermResult_combinationId_termId_idx" ON "academics"."TermResult"("combinationId", "termId");

-- CreateIndex
CREATE INDEX "ReportCard_educationStage_classLevel_termId_idx" ON "academics"."ReportCard"("educationStage", "classLevel", "termId");

-- CreateIndex
CREATE INDEX "ReportCard_combinationId_termId_idx" ON "academics"."ReportCard"("combinationId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectCombination_code_academicYearId_key" ON "academics"."SubjectCombination"("code", "academicYearId");

-- CreateIndex
CREATE INDEX "SubjectCombination_educationStage_academicYearId_isActive_idx" ON "academics"."SubjectCombination"("educationStage", "academicYearId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectCombinationSubject_combinationId_subjectId_key" ON "academics"."SubjectCombinationSubject"("combinationId", "subjectId");

-- CreateIndex
CREATE INDEX "SubjectCombinationSubject_subjectId_idx" ON "academics"."SubjectCombinationSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSubjectEnrollment_studentId_subjectId_academicYearId_termId_key" ON "academics"."StudentSubjectEnrollment"("studentId", "subjectId", "academicYearId", "termId");

-- CreateIndex
CREATE INDEX "StudentSubjectEnrollment_studentId_academicYearId_isActive_idx" ON "academics"."StudentSubjectEnrollment"("studentId", "academicYearId", "isActive");

-- CreateIndex
CREATE INDEX "StudentSubjectEnrollment_classId_academicYearId_isActive_idx" ON "academics"."StudentSubjectEnrollment"("classId", "academicYearId", "isActive");

-- CreateIndex
CREATE INDEX "StudentSubjectEnrollment_combinationId_academicYearId_idx" ON "academics"."StudentSubjectEnrollment"("combinationId", "academicYearId");

-- AddForeignKey
ALTER TABLE "academics"."ClassSubject" ADD CONSTRAINT "ClassSubject_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "academics"."SubjectCombination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."SubjectCombinationSubject" ADD CONSTRAINT "SubjectCombinationSubject_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "academics"."SubjectCombination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."SubjectCombinationSubject" ADD CONSTRAINT "SubjectCombinationSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "academics"."Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."StudentSubjectEnrollment" ADD CONSTRAINT "StudentSubjectEnrollment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "academics"."Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."StudentSubjectEnrollment" ADD CONSTRAINT "StudentSubjectEnrollment_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "academics"."SubjectCombination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
