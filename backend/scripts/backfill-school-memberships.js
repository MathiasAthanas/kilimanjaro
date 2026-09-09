/*
 * Backfills memberships for legacy student and parent accounts.
 *
 * It is idempotent: only missing (user, school, role) memberships are created.
 * Run from backend with: node scripts/backfill-school-memberships.js
 */
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient: AuthPrismaClient } = require('../services/auth-service/generated/prisma');
const { PrismaClient: StudentPrismaClient } = require('../services/student-service/generated/prisma');

const root = path.resolve(__dirname, '..');
const loadDatabaseUrl = (service) => {
  const result = dotenv.config({ path: path.join(root, 'services', service, '.env') });
  if (result.error || !result.parsed?.DATABASE_URL) {
    throw new Error(`DATABASE_URL is required in services/${service}/.env`);
  }
  return result.parsed.DATABASE_URL;
};

const auth = new AuthPrismaClient({
  datasources: { db: { url: loadDatabaseUrl('auth-service') } },
});
const students = new StudentPrismaClient({
  datasources: { db: { url: loadDatabaseUrl('student-service') } },
});

async function main() {
  const assignedBy = await auth.user.findFirst({
    where: {
      isActive: true,
      role: { in: ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'MANAGER'] },
    },
    select: { id: true },
  });
  if (!assignedBy) {
    throw new Error('An active group administrator is required to backfill memberships');
  }

  const legacyUsers = await auth.user.findMany({
    where: {
      role: { in: ['STUDENT', 'PARENT'] },
      schoolMemberships: { none: {} },
    },
    select: { id: true, role: true },
  });

  const studentUserIds = legacyUsers.filter((user) => user.role === 'STUDENT').map((user) => user.id);
  const parentUserIds = legacyUsers.filter((user) => user.role === 'PARENT').map((user) => user.id);

  const studentRows = studentUserIds.length
    ? await students.student.findMany({
      where: { authUserId: { in: studentUserIds }, schoolId: { not: null } },
      select: { authUserId: true, schoolId: true },
    })
    : [];

  const guardianRows = parentUserIds.length
    ? await students.guardian.findMany({
      where: { authUserId: { in: parentUserIds } },
      select: {
        authUserId: true,
        studentLinks: {
          where: { isActive: true },
          select: { student: { select: { schoolId: true } } },
        },
      },
    })
    : [];

  const memberships = [
    ...studentRows.map((student) => ({
      authUserId: student.authUserId,
      schoolId: student.schoolId,
      role: 'STUDENT',
      isActive: true,
      assignedById: assignedBy.id,
    })),
    ...guardianRows.flatMap((guardian) => guardian.studentLinks
      .map((link) => link.student.schoolId)
      .filter(Boolean)
      .map((schoolId) => ({
        authUserId: guardian.authUserId,
        schoolId,
        role: 'PARENT',
        isActive: true,
        assignedById: assignedBy.id,
      }))),
  ];

  const uniqueMemberships = [...new Map(
    memberships.map((membership) => [`${membership.authUserId}:${membership.schoolId}:${membership.role}`, membership]),
  ).values()];

  const result = uniqueMemberships.length
    ? await auth.schoolMembership.createMany({ data: uniqueMemberships, skipDuplicates: true })
    : { count: 0 };

  console.log(JSON.stringify({
    legacyUsers: legacyUsers.length,
    membershipsCreated: result.count,
    unresolvedUsers: legacyUsers.length - new Set(uniqueMemberships.map((membership) => membership.authUserId)).size,
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([auth.$disconnect(), students.$disconnect()]);
  });
