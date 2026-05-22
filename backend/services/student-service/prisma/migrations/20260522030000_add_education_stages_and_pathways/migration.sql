-- CreateEnum
CREATE TYPE "students"."EducationStage" AS ENUM ('PRIMARY', 'O_LEVEL', 'A_LEVEL');

-- CreateEnum
CREATE TYPE "students"."ClassTransitionType" AS ENUM ('PROMOTION', 'CROSS_STAGE', 'GRADUATION', 'TRANSFER');

-- AlterTable
ALTER TABLE "students"."Class"
  ADD COLUMN "educationStage" "students"."EducationStage" NOT NULL DEFAULT 'O_LEVEL',
  ADD COLUMN "curriculumCode" TEXT,
  ADD COLUMN "terminalYear" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sortOrder" INTEGER;

-- CreateTable
CREATE TABLE "students"."ClassPathway" (
  "id" TEXT NOT NULL,
  "fromClassId" TEXT NOT NULL,
  "toClassId" TEXT,
  "academicYearId" TEXT NOT NULL,
  "transitionType" "students"."ClassTransitionType" NOT NULL DEFAULT 'PROMOTION',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassPathway_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Class_educationStage_level_academicYearId_idx" ON "students"."Class"("educationStage", "level", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassPathway_fromClassId_academicYearId_key" ON "students"."ClassPathway"("fromClassId", "academicYearId");

-- CreateIndex
CREATE INDEX "ClassPathway_transitionType_academicYearId_idx" ON "students"."ClassPathway"("transitionType", "academicYearId");

-- AddForeignKey
ALTER TABLE "students"."ClassPathway" ADD CONSTRAINT "ClassPathway_fromClassId_fkey" FOREIGN KEY ("fromClassId") REFERENCES "students"."Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."ClassPathway" ADD CONSTRAINT "ClassPathway_toClassId_fkey" FOREIGN KEY ("toClassId") REFERENCES "students"."Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students"."ClassPathway" ADD CONSTRAINT "ClassPathway_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "students"."AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
