import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async assertParentOwnsStudent(parentAuthUserId: string, studentId: string): Promise<void> {
    const link = await this.prisma.studentGuardianLink.findFirst({
      where: {
        isActive: true,
        studentId,
        guardian: {
          authUserId: parentAuthUserId,
        },
      },
    });

    if (!link) {
      throw new ForbiddenException('Parent is not linked to this student');
    }
  }

  async assertStudentOwnsRecord(studentAuthUserId: string, studentId: string): Promise<void> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { authUserId: true },
    });

    if (!student || student.authUserId !== studentAuthUserId) {
      throw new ForbiddenException('Student cannot access this record');
    }
  }
}