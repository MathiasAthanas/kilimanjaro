import { ForbiddenException } from '@nestjs/common';
import { hasRole, isSelfService } from '@kilimanjaro/security';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma';

export async function authorizeStudent(prisma: PrismaService, studentId: string | undefined, user?: { id: string; role: string; roles?: string[] }) {
  if (!user || !isSelfService(user)) return;
  if (!studentId) throw new ForbiddenException('Student ID is required');
  const alternatives: Prisma.StudentWhereInput[] = [];
  if (hasRole(user, 'STUDENT')) alternatives.push({ authUserId: user.id });
  if (hasRole(user, 'PARENT')) alternatives.push({ parentLinks: { some: { isActive: true, guardian: { authUserId: user.id } } } });
  const student = await prisma.student.findFirst({ where: { id: studentId, OR: alternatives }, select: { id: true } });
  if (!student) throw new ForbiddenException('Student access denied');
}
