-- CreateEnum
CREATE TYPE "academics"."ExamWindowStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'PUBLISHED', 'REOPENED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "academics"."ExamWindowScopeType" AS ENUM ('ALL_CLASSES', 'STANDARDS', 'STREAMS');

-- CreateEnum
CREATE TYPE "academics"."ResultEditRequestStatus" AS ENUM ('REQUESTED', 'GRANTED', 'REJECTED', 'COMPLETED', 'REPUBLISHED');

-- DropForeignKey
ALTER TABLE "academics"."Assessment" DROP CONSTRAINT "Assessment_assessmentTypeId_fkey";

-- AlterTable
ALTER TABLE "academics"."Assessment" ADD COLUMN     "examWindowId" TEXT,
ALTER COLUMN "assessmentTypeId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "academics"."ExamType" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "defaultWeight" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "educationStage" "academics"."EducationStage",
    "color" TEXT DEFAULT '#4338CA',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academics"."ExamWindow" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "examTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "educationStage" "academics"."EducationStage",
    "scopeType" "academics"."ExamWindowScopeType" NOT NULL DEFAULT 'ALL_CLASSES',
    "scopeLevels" INTEGER[],
    "scopeClassIds" TEXT[],
    "status" "academics"."ExamWindowStatus" NOT NULL DEFAULT 'DRAFT',
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "countsToReportCard" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academics"."ExamWindowResult" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "examWindowId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "className" TEXT,
    "stream" TEXT,
    "classLevel" INTEGER,
    "educationStage" "academics"."EducationStage" NOT NULL DEFAULT 'PRIMARY',
    "registrationNumber" TEXT,
    "studentName" TEXT,
    "gender" TEXT,
    "subjectScores" JSONB NOT NULL,
    "subjectCount" INTEGER NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mean" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "meanPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallGrade" TEXT NOT NULL DEFAULT '',
    "overallPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallRemark" TEXT NOT NULL DEFAULT '',
    "isPassing" BOOLEAN NOT NULL DEFAULT false,
    "classMeanDev" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "standardMeanDev" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prevWindowMean" DOUBLE PRECISION,
    "prevWindowDelta" DOUBLE PRECISION,
    "streamRank" INTEGER,
    "streamTotal" INTEGER,
    "standardRank" INTEGER,
    "standardTotal" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamWindowResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academics"."ResultEditRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "examWindowId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "classSubjectId" TEXT,
    "subjectId" TEXT,
    "classId" TEXT,
    "requestedById" TEXT NOT NULL,
    "requestedByRole" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "academics"."ResultEditRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "decidedById" TEXT,
    "decidedByRole" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "republishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultEditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamType_schoolId_isActive_idx" ON "academics"."ExamType"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "ExamType_code_idx" ON "academics"."ExamType"("code");

-- CreateIndex
CREATE INDEX "ExamWindow_schoolId_academicYearId_termId_idx" ON "academics"."ExamWindow"("schoolId", "academicYearId", "termId");

-- CreateIndex
CREATE INDEX "ExamWindow_status_idx" ON "academics"."ExamWindow"("status");

-- CreateIndex
CREATE INDEX "ExamWindow_examTypeId_idx" ON "academics"."ExamWindow"("examTypeId");

-- CreateIndex
CREATE INDEX "ExamWindowResult_examWindowId_classId_idx" ON "academics"."ExamWindowResult"("examWindowId", "classId");

-- CreateIndex
CREATE INDEX "ExamWindowResult_examWindowId_classLevel_idx" ON "academics"."ExamWindowResult"("examWindowId", "classLevel");

-- CreateIndex
CREATE INDEX "ExamWindowResult_studentId_idx" ON "academics"."ExamWindowResult"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamWindowResult_examWindowId_studentId_key" ON "academics"."ExamWindowResult"("examWindowId", "studentId");

-- CreateIndex
CREATE INDEX "ResultEditRequest_examWindowId_status_idx" ON "academics"."ResultEditRequest"("examWindowId", "status");

-- CreateIndex
CREATE INDEX "ResultEditRequest_requestedById_idx" ON "academics"."ResultEditRequest"("requestedById");

-- CreateIndex
CREATE INDEX "ResultEditRequest_schoolId_status_idx" ON "academics"."ResultEditRequest"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Assessment_examWindowId_status_idx" ON "academics"."Assessment"("examWindowId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_classSubjectId_examWindowId_key" ON "academics"."Assessment"("classSubjectId", "examWindowId");

-- AddForeignKey
ALTER TABLE "academics"."Assessment" ADD CONSTRAINT "Assessment_assessmentTypeId_fkey" FOREIGN KEY ("assessmentTypeId") REFERENCES "academics"."AssessmentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."Assessment" ADD CONSTRAINT "Assessment_examWindowId_fkey" FOREIGN KEY ("examWindowId") REFERENCES "academics"."ExamWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."ExamWindow" ADD CONSTRAINT "ExamWindow_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "academics"."ExamType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."ExamWindowResult" ADD CONSTRAINT "ExamWindowResult_examWindowId_fkey" FOREIGN KEY ("examWindowId") REFERENCES "academics"."ExamWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."ResultEditRequest" ADD CONSTRAINT "ResultEditRequest_examWindowId_fkey" FOREIGN KEY ("examWindowId") REFERENCES "academics"."ExamWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

