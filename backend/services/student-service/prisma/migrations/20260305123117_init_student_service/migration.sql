-- CreateEnum
CREATE TYPE "students"."Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "students"."StudentStatus" AS ENUM ('ACTIVE', 'GRADUATED', 'TRANSFERRED', 'SUSPENDED', 'EXPELLED', 'DECEASED');

-- CreateEnum
CREATE TYPE "students"."GuardianRelationship" AS ENUM ('FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "students"."AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "students"."DisciplineCategory" AS ENUM ('MISCONDUCT', 'BULLYING', 'CHEATING', 'ABSENTEEISM', 'VIOLENCE', 'PROPERTY_DAMAGE', 'DISRESPECT', 'OTHER');

-- CreateEnum
CREATE TYPE "students"."DisciplineSeverity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "students"."TrendDirection" AS ENUM ('IMPROVING', 'DECLINING', 'STABLE', 'VOLATILE', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "students"."AlertType" AS ENUM ('CHRONIC_UNDERPERFORMER', 'SUDDEN_DECLINE', 'RAPID_IMPROVEMENT', 'AT_RISK', 'FAILURE_RISK', 'CONSISTENT_EXCELLENCE', 'VOLATILE_PERFORMANCE', 'ATTENDANCE_IMPACT', 'RECOVERED', 'CONSECUTIVE_DECLINE');

-- CreateEnum
CREATE TYPE "students"."AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "students"."PairingSuggestedBy" AS ENUM ('SYSTEM', 'TEACHER', 'HOD', 'PRINCIPAL');

-- CreateEnum
CREATE TYPE "students"."PairingStatus" AS ENUM ('SUGGESTED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "students"."Student" (
    "id" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "students"."Gender" NOT NULL,
    "nationality" TEXT NOT NULL DEFAULT 'Tanzanian',
    "profilePhotoUrl" TEXT,
    "status" "students"."StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "admissionDate" TIMESTAMP(3) NOT NULL,
    "graduationDate" TIMESTAMP(3),
    "transferDate" TIMESTAMP(3),
    "transferSchool" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."Guardian" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "relationship" "students"."GuardianRelationship" NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "email" TEXT,
    "occupation" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."StudentGuardianLink" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinkedAt" TIMESTAMP(3),

    CONSTRAINT "StudentGuardianLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."AcademicYear" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."Term" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."Class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "stream" TEXT,
    "academicYearId" TEXT NOT NULL,
    "classTeacherId" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 40,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."Enrolment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "promotedFrom" TEXT,
    "promotedAt" TIMESTAMP(3),

    CONSTRAINT "Enrolment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."AttendanceRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "termId" TEXT NOT NULL,
    "status" "students"."AttendanceStatus" NOT NULL,
    "markedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."DisciplineRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "category" "students"."DisciplineCategory" NOT NULL,
    "severity" "students"."DisciplineSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "actionTaken" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "requiresParentNotification" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplineRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."PerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "grade" TEXT NOT NULL,
    "assessmentBreakdown" JSONB NOT NULL,
    "rank" INTEGER,
    "totalStudentsInClass" INTEGER,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."PerformanceTrend" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "currentScore" DOUBLE PRECISION NOT NULL,
    "previousScore" DOUBLE PRECISION,
    "averageScore" DOUBLE PRECISION NOT NULL,
    "highestScore" DOUBLE PRECISION NOT NULL,
    "lowestScore" DOUBLE PRECISION NOT NULL,
    "trendDirection" "students"."TrendDirection" NOT NULL,
    "trendSlope" DOUBLE PRECISION,
    "consecutiveDeclines" INTEGER NOT NULL DEFAULT 0,
    "consecutiveImprovements" INTEGER NOT NULL DEFAULT 0,
    "termCount" INTEGER NOT NULL,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceTrend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."PerformanceAlert" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "alertType" "students"."AlertType" NOT NULL,
    "severity" "students"."AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "triggeredBySnapshotId" TEXT NOT NULL,
    "currentScore" DOUBLE PRECISION NOT NULL,
    "thresholdValue" DOUBLE PRECISION NOT NULL,
    "trendSlope" DOUBLE PRECISION,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "notificationSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."PeerPairing" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "peerId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "suggestedBy" "students"."PairingSuggestedBy" NOT NULL,
    "status" "students"."PairingStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "studentScoreAtPairing" DOUBLE PRECISION NOT NULL,
    "peerScoreAtPairing" DOUBLE PRECISION NOT NULL,
    "outcomeScore" DOUBLE PRECISION,
    "outcomeDelta" DOUBLE PRECISION,
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeerPairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."PerformanceEngineConfig" (
    "id" TEXT NOT NULL,
    "failureThreshold" DOUBLE PRECISION NOT NULL DEFAULT 40.0,
    "atRiskThreshold" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "excellenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 80.0,
    "suddenDeclineThreshold" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "rapidImprovementThreshold" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "chronicUnderperformanceTerms" INTEGER NOT NULL DEFAULT 3,
    "consecutiveDeclineTerms" INTEGER NOT NULL DEFAULT 2,
    "peerSuggestionMinPeerScore" DOUBLE PRECISION NOT NULL DEFAULT 75.0,
    "peerSuggestionMaxScoreGap" DOUBLE PRECISION NOT NULL DEFAULT 40.0,
    "peerSuggestionSameClass" BOOLEAN NOT NULL DEFAULT true,
    "volatilityStdDevThreshold" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "analysisEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoNotifyTeacher" BOOLEAN NOT NULL DEFAULT true,
    "autoNotifyAcademicDept" BOOLEAN NOT NULL DEFAULT true,
    "autoNotifyParent" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PerformanceEngineConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."RegistrationSequence" (
    "year" INTEGER NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationSequence_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_registrationNumber_key" ON "students"."Student"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Student_authUserId_key" ON "students"."Student"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_authUserId_key" ON "students"."Guardian"("authUserId");

-- CreateIndex
CREATE INDEX "StudentGuardianLink_guardianId_isActive_idx" ON "students"."StudentGuardianLink"("guardianId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardianLink_studentId_guardianId_key" ON "students"."StudentGuardianLink"("studentId", "guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_name_key" ON "students"."AcademicYear"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Term_academicYearId_name_key" ON "students"."Term"("academicYearId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Class_name_stream_academicYearId_key" ON "students"."Class"("name", "stream", "academicYearId");

-- CreateIndex
CREATE INDEX "Enrolment_studentId_isActive_idx" ON "students"."Enrolment"("studentId", "isActive");

-- CreateIndex
CREATE INDEX "Enrolment_classId_isActive_idx" ON "students"."Enrolment"("classId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Enrolment_studentId_classId_academicYearId_key" ON "students"."Enrolment"("studentId", "classId", "academicYearId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_date_idx" ON "students"."AttendanceRecord"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_studentId_date_classId_key" ON "students"."AttendanceRecord"("studentId", "date", "classId");

-- CreateIndex
CREATE INDEX "DisciplineRecord_studentId_createdAt_idx" ON "students"."DisciplineRecord"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "PerformanceSnapshot_studentId_subjectId_idx" ON "students"."PerformanceSnapshot"("studentId", "subjectId");

-- CreateIndex
CREATE INDEX "PerformanceSnapshot_teacherId_idx" ON "students"."PerformanceSnapshot"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceSnapshot_studentId_subjectId_termId_key" ON "students"."PerformanceSnapshot"("studentId", "subjectId", "termId");

-- CreateIndex
CREATE INDEX "PerformanceTrend_subjectId_idx" ON "students"."PerformanceTrend"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceTrend_studentId_subjectId_key" ON "students"."PerformanceTrend"("studentId", "subjectId");

-- CreateIndex
CREATE INDEX "PerformanceAlert_studentId_isResolved_idx" ON "students"."PerformanceAlert"("studentId", "isResolved");

-- CreateIndex
CREATE INDEX "PerformanceAlert_alertType_isResolved_idx" ON "students"."PerformanceAlert"("alertType", "isResolved");

-- CreateIndex
CREATE INDEX "PerformanceAlert_subjectId_isResolved_idx" ON "students"."PerformanceAlert"("subjectId", "isResolved");

-- CreateIndex
CREATE INDEX "PeerPairing_studentId_status_idx" ON "students"."PeerPairing"("studentId", "status");

-- CreateIndex
CREATE INDEX "PeerPairing_subjectId_status_idx" ON "students"."PeerPairing"("subjectId", "status");

-- CreateIndex
CREATE INDEX "PeerPairing_peerId_status_idx" ON "students"."PeerPairing"("peerId", "status");

-- AddForeignKey
ALTER TABLE "students"."StudentGuardianLink" ADD CONSTRAINT "StudentGuardianLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."StudentGuardianLink" ADD CONSTRAINT "StudentGuardianLink_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "students"."Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."Term" ADD CONSTRAINT "Term_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "students"."AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."Class" ADD CONSTRAINT "Class_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "students"."AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."Enrolment" ADD CONSTRAINT "Enrolment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."Enrolment" ADD CONSTRAINT "Enrolment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "students"."Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."Enrolment" ADD CONSTRAINT "Enrolment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "students"."AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."Enrolment" ADD CONSTRAINT "Enrolment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "students"."Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_classId_fkey" FOREIGN KEY ("classId") REFERENCES "students"."Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "students"."Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."DisciplineRecord" ADD CONSTRAINT "DisciplineRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_classId_fkey" FOREIGN KEY ("classId") REFERENCES "students"."Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_termId_fkey" FOREIGN KEY ("termId") REFERENCES "students"."Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "students"."AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."PerformanceTrend" ADD CONSTRAINT "PerformanceTrend_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."PerformanceAlert" ADD CONSTRAINT "PerformanceAlert_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."PerformanceAlert" ADD CONSTRAINT "PerformanceAlert_triggeredBySnapshotId_fkey" FOREIGN KEY ("triggeredBySnapshotId") REFERENCES "students"."PerformanceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."PeerPairing" ADD CONSTRAINT "PeerPairing_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."PeerPairing" ADD CONSTRAINT "PeerPairing_peerId_fkey" FOREIGN KEY ("peerId") REFERENCES "students"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."PeerPairing" ADD CONSTRAINT "PeerPairing_classId_fkey" FOREIGN KEY ("classId") REFERENCES "students"."Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."PeerPairing" ADD CONSTRAINT "PeerPairing_termId_fkey" FOREIGN KEY ("termId") REFERENCES "students"."Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
