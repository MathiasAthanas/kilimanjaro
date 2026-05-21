-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "academics";

-- CreateEnum
CREATE TYPE "academics"."AssessmentStatus" AS ENUM ('DRAFT', 'OPEN', 'MARKS_ENTERED', 'SUBMITTED', 'HOD_APPROVED', 'APPROVED', 'REJECTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "academics"."ApprovalAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'REOPENED', 'LOCKED', 'UNLOCKED', 'EDITED');

-- CreateEnum
CREATE TYPE "academics"."DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');

-- CreateEnum
CREATE TYPE "academics"."InterventionType" AS ENUM ('ALERT_RESOLVED', 'ALERT_ESCALATED', 'PAIRING_ACTIVATED', 'PAIRING_REJECTED', 'MANUAL_PAIRING_CREATED', 'TEACHER_SUPPORT_GIVEN', 'PARENT_MEETING_SCHEDULED', 'ADDITIONAL_LESSONS_ASSIGNED', 'OTHER');

-- CreateTable
CREATE TABLE "academics"."Subject" (    "id" TEXT NOT NULL,    "name" TEXT NOT NULL,    "code" TEXT NOT NULL,    "description" TEXT,    "isCompulsory" BOOLEAN NOT NULL DEFAULT true,    "isActive" BOOLEAN NOT NULL DEFAULT true,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "updatedAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."ClassSubject" (    "id" TEXT NOT NULL,    "classId" TEXT NOT NULL,    "subjectId" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "teacherId" TEXT NOT NULL,    "isActive" BOOLEAN NOT NULL DEFAULT true,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    CONSTRAINT "ClassSubject_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."GradingScale" (    "id" TEXT NOT NULL,    "name" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "isActive" BOOLEAN NOT NULL DEFAULT false,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    CONSTRAINT "GradingScale_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."GradeBoundary" (    "id" TEXT NOT NULL,    "gradingScaleId" TEXT NOT NULL,    "grade" TEXT NOT NULL,    "minScore" DOUBLE PRECISION NOT NULL,    "maxScore" DOUBLE PRECISION NOT NULL,    "points" DOUBLE PRECISION NOT NULL,    "remark" TEXT NOT NULL,    "isPassing" BOOLEAN NOT NULL DEFAULT true,    CONSTRAINT "GradeBoundary_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."AssessmentType" (    "id" TEXT NOT NULL,    "name" TEXT NOT NULL,    "code" TEXT NOT NULL,    "weightPercentage" DOUBLE PRECISION NOT NULL,    "academicYearId" TEXT NOT NULL,    "isActive" BOOLEAN NOT NULL DEFAULT true,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    CONSTRAINT "AssessmentType_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."Assessment" (    "id" TEXT NOT NULL,    "classSubjectId" TEXT NOT NULL,    "assessmentTypeId" TEXT NOT NULL,    "subjectId" TEXT NOT NULL,    "classId" TEXT NOT NULL,    "termId" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "name" TEXT NOT NULL,    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,    "date" TIMESTAMP(3),    "status" "academics"."AssessmentStatus" NOT NULL DEFAULT 'DRAFT',    "submittedAt" TIMESTAMP(3),    "submittedById" TEXT,    "approvedAt" TIMESTAMP(3),    "approvedById" TEXT,    "rejectedAt" TIMESTAMP(3),    "rejectedById" TEXT,    "rejectionReason" TEXT,    "lockedAt" TIMESTAMP(3),    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "updatedAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."Mark" (    "id" TEXT NOT NULL,    "assessmentId" TEXT NOT NULL,    "classSubjectId" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "score" DOUBLE PRECISION NOT NULL,    "isAbsent" BOOLEAN NOT NULL DEFAULT false,    "note" TEXT,    "enteredById" TEXT NOT NULL,    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "lastEditedById" TEXT,    "lastEditedAt" TIMESTAMP(3),    "isLocked" BOOLEAN NOT NULL DEFAULT false,    CONSTRAINT "Mark_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."TermResult" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "classId" TEXT NOT NULL,    "classSubjectId" TEXT NOT NULL,    "subjectId" TEXT NOT NULL,    "subjectName" TEXT NOT NULL,    "termId" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "assessmentScores" JSONB NOT NULL,    "weightedTotal" DOUBLE PRECISION NOT NULL,    "grade" TEXT NOT NULL,    "gradePoints" DOUBLE PRECISION NOT NULL,    "remark" TEXT NOT NULL,    "isPassing" BOOLEAN NOT NULL,    "rank" INTEGER,    "totalStudentsInClass" INTEGER,    "teacherId" TEXT NOT NULL,    "isPublished" BOOLEAN NOT NULL DEFAULT false,    "publishedAt" TIMESTAMP(3),    "publishedById" TEXT,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "updatedAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "TermResult_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."ReportCard" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "classId" TEXT NOT NULL,    "termId" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "overallAverage" DOUBLE PRECISION NOT NULL,    "overallGrade" TEXT NOT NULL,    "overallPoints" DOUBLE PRECISION NOT NULL,    "overallRemark" TEXT NOT NULL,    "rank" INTEGER,    "totalStudentsInClass" INTEGER,    "subjectCount" INTEGER NOT NULL,    "failingSubjectCount" INTEGER NOT NULL,    "teacherComment" TEXT,    "principalComment" TEXT,    "principalSignedAt" TIMESTAMP(3),    "principalSignedById" TEXT,    "pdfUrl" TEXT,    "pdfGeneratedAt" TIMESTAMP(3),    "isPublished" BOOLEAN NOT NULL DEFAULT false,    "publishedAt" TIMESTAMP(3),    "publishedById" TEXT,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "updatedAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."ApprovalLog" (    "id" TEXT NOT NULL,    "assessmentId" TEXT NOT NULL,    "action" "academics"."ApprovalAction" NOT NULL,    "performedById" TEXT NOT NULL,    "performedByRole" TEXT NOT NULL,    "note" TEXT,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    CONSTRAINT "ApprovalLog_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."Timetable" (    "id" TEXT NOT NULL,    "classId" TEXT NOT NULL,    "subjectId" TEXT NOT NULL,    "teacherId" TEXT NOT NULL,    "termId" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "dayOfWeek" "academics"."DayOfWeek" NOT NULL,    "startTime" TEXT NOT NULL,    "endTime" TEXT NOT NULL,    "room" TEXT,    CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."SyllabusTracker" (    "id" TEXT NOT NULL,    "classSubjectId" TEXT NOT NULL,    "termId" TEXT NOT NULL,    "totalTopics" INTEGER NOT NULL,    "coveredTopics" INTEGER NOT NULL DEFAULT 0,    "completionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,    "lastUpdatedById" TEXT NOT NULL,    "notes" TEXT,    "updatedAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "SyllabusTracker_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."AcademicIntervention" (    "id" TEXT NOT NULL,    "alertId" TEXT,    "pairingId" TEXT,    "studentId" TEXT NOT NULL,    "subjectId" TEXT,    "subjectName" TEXT,    "type" "academics"."InterventionType" NOT NULL,    "performedById" TEXT NOT NULL,    "performedByRole" TEXT NOT NULL,    "note" TEXT NOT NULL,    "outcome" TEXT,    "followUpDate" TIMESTAMP(3),    "isFollowedUp" BOOLEAN NOT NULL DEFAULT false,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "updatedAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "AcademicIntervention_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "academics"."AcademicAuditLog" (    "id" TEXT NOT NULL,    "action" TEXT NOT NULL,    "performedById" TEXT NOT NULL,    "payload" JSONB NOT NULL,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    CONSTRAINT "AcademicAuditLog_pkey" PRIMARY KEY ("id"));

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "academics"."Subject"("code");

-- CreateIndex
CREATE INDEX "ClassSubject_classId_academicYearId_idx" ON "academics"."ClassSubject"("classId", "academicYearId");

-- CreateIndex
CREATE INDEX "ClassSubject_teacherId_idx" ON "academics"."ClassSubject"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubject_classId_subjectId_academicYearId_key" ON "academics"."ClassSubject"("classId", "subjectId", "academicYearId");

-- CreateIndex
CREATE INDEX "GradingScale_academicYearId_isActive_idx" ON "academics"."GradingScale"("academicYearId", "isActive");

-- CreateIndex
CREATE INDEX "GradeBoundary_gradingScaleId_minScore_maxScore_idx" ON "academics"."GradeBoundary"("gradingScaleId", "minScore", "maxScore");

-- CreateIndex
CREATE UNIQUE INDEX "GradeBoundary_gradingScaleId_grade_key" ON "academics"."GradeBoundary"("gradingScaleId", "grade");

-- CreateIndex
CREATE INDEX "AssessmentType_academicYearId_isActive_idx" ON "academics"."AssessmentType"("academicYearId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentType_code_academicYearId_key" ON "academics"."AssessmentType"("code", "academicYearId");

-- CreateIndex
CREATE INDEX "Assessment_classId_termId_status_idx" ON "academics"."Assessment"("classId", "termId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_classSubjectId_assessmentTypeId_termId_key" ON "academics"."Assessment"("classSubjectId", "assessmentTypeId", "termId");

-- CreateIndex
CREATE INDEX "Mark_studentId_idx" ON "academics"."Mark"("studentId");

-- CreateIndex
CREATE INDEX "Mark_assessmentId_idx" ON "academics"."Mark"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Mark_assessmentId_studentId_key" ON "academics"."Mark"("assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "TermResult_studentId_termId_idx" ON "academics"."TermResult"("studentId", "termId");

-- CreateIndex
CREATE INDEX "TermResult_classId_termId_idx" ON "academics"."TermResult"("classId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "TermResult_studentId_classSubjectId_termId_key" ON "academics"."TermResult"("studentId", "classSubjectId", "termId");

-- CreateIndex
CREATE INDEX "ReportCard_classId_termId_idx" ON "academics"."ReportCard"("classId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCard_studentId_termId_key" ON "academics"."ReportCard"("studentId", "termId");

-- CreateIndex
CREATE INDEX "ApprovalLog_assessmentId_createdAt_idx" ON "academics"."ApprovalLog"("assessmentId", "createdAt");

-- CreateIndex
CREATE INDEX "Timetable_classId_termId_idx" ON "academics"."Timetable"("classId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "Timetable_classId_dayOfWeek_startTime_termId_key" ON "academics"."Timetable"("classId", "dayOfWeek", "startTime", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusTracker_classSubjectId_termId_key" ON "academics"."SyllabusTracker"("classSubjectId", "termId");

-- CreateIndex
CREATE INDEX "AcademicIntervention_studentId_idx" ON "academics"."AcademicIntervention"("studentId");

-- CreateIndex
CREATE INDEX "AcademicIntervention_performedById_idx" ON "academics"."AcademicIntervention"("performedById");

-- CreateIndex
CREATE INDEX "AcademicAuditLog_performedById_idx" ON "academics"."AcademicAuditLog"("performedById");

-- AddForeignKey
ALTER TABLE "academics"."ClassSubject" ADD CONSTRAINT "ClassSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "academics"."Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."GradeBoundary" ADD CONSTRAINT "GradeBoundary_gradingScaleId_fkey" FOREIGN KEY ("gradingScaleId") REFERENCES "academics"."GradingScale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."Assessment" ADD CONSTRAINT "Assessment_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "academics"."ClassSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."Assessment" ADD CONSTRAINT "Assessment_assessmentTypeId_fkey" FOREIGN KEY ("assessmentTypeId") REFERENCES "academics"."AssessmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."Assessment" ADD CONSTRAINT "Assessment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "academics"."Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."Mark" ADD CONSTRAINT "Mark_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "academics"."Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."Mark" ADD CONSTRAINT "Mark_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "academics"."ClassSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."TermResult" ADD CONSTRAINT "TermResult_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "academics"."ClassSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."ApprovalLog" ADD CONSTRAINT "ApprovalLog_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "academics"."Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."Timetable" ADD CONSTRAINT "Timetable_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "academics"."Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academics"."SyllabusTracker" ADD CONSTRAINT "SyllabusTracker_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "academics"."ClassSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;