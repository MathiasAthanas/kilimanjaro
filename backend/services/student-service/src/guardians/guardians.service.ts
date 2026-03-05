import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';

@Injectable()
export class GuardiansService {
  constructor(private readonly prisma: PrismaService) {}

  async addGuardian(studentId: string, dto: CreateGuardianDto): Promise<unknown> {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const guardian = dto.authUserId
      ? await this.prisma.guardian.upsert({
          where: { authUserId: dto.authUserId },
          create: {
            authUserId: dto.authUserId,
            firstName: dto.firstName,
            lastName: dto.lastName,
            relationship: dto.relationship,
            phoneNumber: dto.phoneNumber,
            email: dto.email,
          },
          update: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            relationship: dto.relationship,
            phoneNumber: dto.phoneNumber,
            email: dto.email,
          },
        })
      : await this.prisma.guardian.create({
          data: {
            authUserId: randomUUID(),
            firstName: dto.firstName,
            lastName: dto.lastName,
            relationship: dto.relationship,
            phoneNumber: dto.phoneNumber,
            email: dto.email,
          },
        });

    await this.prisma.studentGuardianLink.upsert({
      where: {
        studentId_guardianId: {
          studentId,
          guardianId: guardian.id,
        },
      },
      create: {
        studentId,
        guardianId: guardian.id,
        isPrimary: Boolean(dto.isPrimary),
        isActive: true,
      },
      update: {
        isPrimary: Boolean(dto.isPrimary),
        isActive: true,
        unlinkedAt: null,
      },
    });

    return this.listByStudent(studentId);
  }

  async listByStudent(studentId: string): Promise<unknown> {
    return this.prisma.studentGuardianLink.findMany({
      where: { studentId, isActive: true },
      include: {
        guardian: true,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async update(studentId: string, guardianId: string, dto: UpdateGuardianDto): Promise<unknown> {
    const link = await this.prisma.studentGuardianLink.findUnique({
      where: {
        studentId_guardianId: {
          studentId,
          guardianId,
        },
      },
    });

    if (!link || !link.isActive) {
      throw new NotFoundException('Guardian link not found');
    }

    await this.prisma.guardian.update({
      where: { id: guardianId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        relationship: dto.relationship,
        phoneNumber: dto.phoneNumber,
        email: dto.email,
      },
    });

    if (typeof dto.isPrimary === 'boolean') {
      await this.prisma.studentGuardianLink.update({
        where: {
          studentId_guardianId: {
            studentId,
            guardianId,
          },
        },
        data: {
          isPrimary: dto.isPrimary,
        },
      });
    }

    return this.listByStudent(studentId);
  }

  async unlink(studentId: string, guardianId: string): Promise<{ unlinked: boolean }> {
    const link = await this.prisma.studentGuardianLink.findUnique({
      where: {
        studentId_guardianId: {
          studentId,
          guardianId,
        },
      },
    });

    if (!link || !link.isActive) {
      throw new NotFoundException('Guardian link not found');
    }

    await this.prisma.studentGuardianLink.update({
      where: {
        studentId_guardianId: {
          studentId,
          guardianId,
        },
      },
      data: {
        isActive: false,
        unlinkedAt: new Date(),
      },
    });

    return { unlinked: true };
  }
}
