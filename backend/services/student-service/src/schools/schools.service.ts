import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Gender, SchoolGender } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { isGroupScope, schoolInScope } from '../common/helpers/school-scope.helper';
import { CreateSchoolDto, UpdateSchoolDto } from './schools.dto';

@Injectable()
export class SchoolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  private slugify(name: string): string {
    return (
      'KS-' +
      name
        .replace(/kilimanjaro/i, '')
        .replace(/school(s)?/i, '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 12)
    ) || `KS-${Date.now()}`;
  }

  async create(dto: CreateSchoolDto, actorId: string) {
    const code = dto.code?.trim().toUpperCase() || this.slugify(dto.name);
    const existing = await this.prisma.school.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`School code ${code} already exists`);

    const school = await this.prisma.school.create({
      data: {
        name: dto.name.trim(),
        code,
        type: dto.type,
        gender: dto.gender ?? SchoolGender.BOTH,
        motto: dto.motto,
        logoUrl: dto.logoUrl,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        createdBy: actorId,
      },
    });

    await this.rabbitMq.publish('school.created', {
      id: school.id,
      name: school.name,
      code: school.code,
      type: school.type,
      gender: school.gender,
      isActive: school.isActive,
    });

    return school;
  }

  async list(user?: RequestUser) {
    const schools = await this.prisma.school.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    if (isGroupScope(user)) return schools;
    return schools.filter((s) => schoolInScope(user, s.id));
  }

  async findById(id: string, user?: RequestUser) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException('School not found');
    if (!schoolInScope(user, id)) throw new NotFoundException('School not found');
    return school;
  }

  async update(id: string, dto: UpdateSchoolDto, actorId: string) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException('School not found');

    // Gender narrowing guard (Doc 05 §2): warn callers when enrolled students
    // of the excluded gender exist; the UI must send acknowledgeNarrowing.
    if (dto.gender && dto.gender !== SchoolGender.BOTH && dto.gender !== school.gender) {
      const excluded = dto.gender === SchoolGender.MALE ? Gender.FEMALE : Gender.MALE;
      const affected = await this.prisma.student.count({
        where: { schoolId: id, gender: excluded, status: 'ACTIVE' },
      });
      if (affected > 0 && !dto.acknowledgeNarrowing) {
        throw new BadRequestException(
          `Narrowing to ${dto.gender} affects ${affected} enrolled ${excluded.toLowerCase()} student(s). ` +
            'Re-submit with acknowledgeNarrowing=true to confirm (existing students are kept; new enrolment is restricted).',
        );
      }
    }

    const updated = await this.prisma.school.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        gender: dto.gender,
        motto: dto.motto,
        logoUrl: dto.logoUrl,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
      },
    });

    await this.rabbitMq.publish('school.updated', {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      type: updated.type,
      gender: updated.gender,
      isActive: updated.isActive,
    });

    return updated;
  }

  async setStatus(id: string, isActive: boolean, actorId: string) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException('School not found');
    const updated = await this.prisma.school.update({ where: { id }, data: { isActive } });
    await this.rabbitMq.publish('school.updated', {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      type: updated.type,
      gender: updated.gender,
      isActive: updated.isActive,
    });
    return updated;
  }

  async summary(id: string, user?: RequestUser) {
    const school = await this.findById(id, user);
    const [students, classes, capacityAgg, applicants] = await Promise.all([
      this.prisma.student.count({ where: { schoolId: id, status: 'ACTIVE' } }),
      this.prisma.class.count({ where: { schoolId: id } }),
      this.prisma.class.aggregate({ where: { schoolId: id }, _sum: { capacity: true } }),
      this.prisma.applicant.count({
        where: { schoolId: id, stage: { notIn: ['ENROLLED', 'REJECTED', 'WITHDRAWN'] } },
      }),
    ]);
    const capacity = capacityAgg._sum.capacity ?? 0;
    return {
      school,
      students,
      classes,
      capacity,
      available: Math.max(capacity - students, 0),
      admissionsPipeline: applicants,
    };
  }
}
