/**
 * Tanzania grading-scale seed for academic-service.
 *
 * Academic years and terms are owned by student-service. This service stores
 * their ids as external strings, so pass ACADEMIC_YEAR_ID when seeding a real
 * environment. Default is "2026" for local/demo data.
 */

import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();
const academicYearId = process.env.ACADEMIC_YEAR_ID || '2026';

type Stage = 'PRIMARY' | 'O_LEVEL' | 'A_LEVEL';
type Boundary = {
  grade: string;
  minScore: number;
  maxScore: number;
  points: number;
  remark: string;
  isPassing: boolean;
};

async function seedScale(name: string, educationStage: Stage, boundaries: Boundary[]) {
  const existing = await prisma.gradingScale.findFirst({
    where: { academicYearId, name, educationStage },
  });
  if (existing) {
    console.log(`Scale "${name}" already exists - skipped`);
    return;
  }

  await prisma.gradingScale.create({
    data: {
      name,
      academicYearId,
      educationStage,
      isActive: true,
      grades: { create: boundaries },
    },
  });
  console.log(`Created grading scale "${name}"`);
}

async function seedAssessmentType(
  name: string,
  code: string,
  weightPercentage: number,
  educationStage: Stage,
  classLevel?: number,
) {
  const existing = await prisma.assessmentType.findFirst({
    where: {
      code,
      academicYearId,
      educationStage,
      classLevel: classLevel ?? null,
      subjectId: null,
    },
  });
  if (existing) {
    console.log(`Assessment type "${code}" already exists - skipped`);
    return;
  }

  await prisma.assessmentType.create({
    data: {
      name,
      code,
      weightPercentage,
      academicYearId,
      educationStage,
      classLevel,
      subjectId: undefined,
      isActive: true,
    },
  });
  console.log(`Created assessment type "${code}" (${weightPercentage}%)`);
}

async function main() {
  await seedScale('Primary Standard 2026', 'PRIMARY', [
    { grade: 'A', minScore: 75, maxScore: 100, points: 4, remark: 'Excellent', isPassing: true },
    { grade: 'B', minScore: 50, maxScore: 74, points: 3, remark: 'Good', isPassing: true },
    { grade: 'C', minScore: 30, maxScore: 49, points: 2, remark: 'Average', isPassing: false },
    { grade: 'D', minScore: 0, maxScore: 29, points: 1, remark: 'Weak', isPassing: false },
  ]);

  await seedScale('O-Level CSEE 2026', 'O_LEVEL', [
    { grade: 'A', minScore: 75, maxScore: 100, points: 1, remark: 'Distinction', isPassing: true },
    { grade: 'B', minScore: 60, maxScore: 74, points: 2, remark: 'Credit', isPassing: true },
    { grade: 'C', minScore: 45, maxScore: 59, points: 3, remark: 'Merit', isPassing: true },
    { grade: 'D', minScore: 30, maxScore: 44, points: 4, remark: 'Pass', isPassing: true },
    { grade: 'F', minScore: 0, maxScore: 29, points: 5, remark: 'Fail', isPassing: false },
  ]);

  await seedScale('A-Level ACSEE 2026', 'A_LEVEL', [
    { grade: 'A', minScore: 80, maxScore: 100, points: 5, remark: 'Distinction', isPassing: true },
    { grade: 'B', minScore: 60, maxScore: 79, points: 4, remark: 'Credit', isPassing: true },
    { grade: 'C', minScore: 45, maxScore: 59, points: 3, remark: 'Merit', isPassing: true },
    { grade: 'D', minScore: 30, maxScore: 44, points: 2, remark: 'Pass', isPassing: true },
    { grade: 'E', minScore: 25, maxScore: 29, points: 1, remark: 'Subsidiary Pass', isPassing: true },
    { grade: 'S', minScore: 20, maxScore: 24, points: 0, remark: 'Subsidiary', isPassing: false },
    { grade: 'F', minScore: 0, maxScore: 19, points: 0, remark: 'Fail', isPassing: false },
  ]);

  await seedAssessmentType('Class Activity Test', 'CAT1', 40, 'PRIMARY');
  await seedAssessmentType('End-of-Term Exam', 'FINAL', 60, 'PRIMARY');
  await seedAssessmentType('Continuous Assessment 1', 'CAT1', 20, 'O_LEVEL');
  await seedAssessmentType('Continuous Assessment 2', 'CAT2', 20, 'O_LEVEL');
  await seedAssessmentType('Mid-Term Exam', 'MIDTERM', 20, 'O_LEVEL');
  await seedAssessmentType('End-of-Term Exam', 'FINAL', 40, 'O_LEVEL');
  await seedAssessmentType('Continuous Assessment', 'CAT1', 30, 'A_LEVEL');
  await seedAssessmentType('End-of-Term Exam', 'FINAL', 70, 'A_LEVEL');

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
