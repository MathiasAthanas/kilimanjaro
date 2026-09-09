-- Admissions pipeline: applicants, stage events, assessments, offers

-- CreateEnum
CREATE TYPE "students"."AdmissionStage" AS ENUM ('INQUIRY', 'APPLICATION', 'ASSESSMENT', 'OFFER', 'ACCEPTED', 'ENROLLED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "students"."AdmissionSourceChannel" AS ENUM ('WALK_IN', 'REFERRAL', 'WEBSITE', 'SOCIAL_MEDIA', 'PHONE_CALL', 'SCHOOL_EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "students"."AdmissionAssessmentOutcome" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'WAIVED');

-- CreateEnum
CREATE TYPE "students"."AdmissionOfferDecision" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "students"."Applicant" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "students"."Gender",
    "nationality" TEXT NOT NULL DEFAULT 'Tanzanian',
    "previousSchool" TEXT,
    "prospectiveClassId" TEXT,
    "educationStage" "students"."EducationStage",
    "guardianFirstName" TEXT NOT NULL,
    "guardianLastName" TEXT NOT NULL,
    "guardianPhone" TEXT NOT NULL,
    "guardianEmail" TEXT,
    "guardianRelationship" "students"."GuardianRelationship" NOT NULL DEFAULT 'GUARDIAN',
    "sourceChannel" "students"."AdmissionSourceChannel" NOT NULL DEFAULT 'WALK_IN',
    "stage" "students"."AdmissionStage" NOT NULL DEFAULT 'INQUIRY',
    "notes" TEXT,
    "studentId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."ApplicantStageEvent" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "fromStage" "students"."AdmissionStage",
    "toStage" "students"."AdmissionStage" NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicantStageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."AdmissionAssessment" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "subjectFocus" TEXT,
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION DEFAULT 100,
    "outcome" "students"."AdmissionAssessmentOutcome" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students"."AdmissionOffer" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "admissionNumber" TEXT,
    "feeExpectation" DOUBLE PRECISION,
    "decision" "students"."AdmissionOfferDecision" NOT NULL DEFAULT 'PENDING',
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "AdmissionOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_studentId_key" ON "students"."Applicant"("studentId");

-- CreateIndex
CREATE INDEX "Applicant_stage_createdAt_idx" ON "students"."Applicant"("stage", "createdAt");

-- CreateIndex
CREATE INDEX "Applicant_guardianPhone_idx" ON "students"."Applicant"("guardianPhone");

-- CreateIndex
CREATE INDEX "Applicant_prospectiveClassId_stage_idx" ON "students"."Applicant"("prospectiveClassId", "stage");

-- CreateIndex
CREATE INDEX "ApplicantStageEvent_applicantId_createdAt_idx" ON "students"."ApplicantStageEvent"("applicantId", "createdAt");

-- CreateIndex
CREATE INDEX "AdmissionAssessment_applicantId_idx" ON "students"."AdmissionAssessment"("applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionOffer_applicantId_key" ON "students"."AdmissionOffer"("applicantId");

-- AddForeignKey
ALTER TABLE "students"."Applicant" ADD CONSTRAINT "Applicant_prospectiveClassId_fkey" FOREIGN KEY ("prospectiveClassId") REFERENCES "students"."Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."ApplicantStageEvent" ADD CONSTRAINT "ApplicantStageEvent_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "students"."Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."AdmissionAssessment" ADD CONSTRAINT "AdmissionAssessment_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "students"."Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."AdmissionOffer" ADD CONSTRAINT "AdmissionOffer_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "students"."Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
