import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolInScope, schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { StudentClientService } from '../student-client/student-client.service';
import { CreateDefaulterContactDto } from './dto/create-contact.dto';

/** Follow-up log for families who owe fees: who was contacted, how, what they promised. */
@Injectable()
export class DefaulterContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentClient: StudentClientService,
  ) {}

  /** Contacts in the caller's schools, newest first. */
  list(user: RequestUser, studentId?: string) {
    return this.prisma.defaulterContact.findMany({
      where: { ...schoolScopeFilter(user), studentId: studentId || undefined },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
  }

  async create(dto: CreateDefaulterContactDto, user: RequestUser) {
    const student = (await this.studentClient.lookupStudents([dto.studentId])).get(dto.studentId);
    if (!student) throw new NotFoundException('Student not found');
    if (!student.schoolId) throw new ForbiddenException('This student is not linked to a school');
    assertSchoolInScope(user, student.schoolId);
    return this.prisma.defaulterContact.create({
      data: {
        schoolId: student.schoolId,
        studentId: dto.studentId,
        note: dto.note.trim(),
        method: dto.method ?? 'OTHER',
        status: dto.status ?? 'CONTACTED',
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
        createdById: user.id,
        createdByRole: user.role,
        createdByLabel: user.email ?? user.role,
      },
    });
  }
}
