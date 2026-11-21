import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdmissionStage, Gender, ResidenceType } from '../../generated/prisma';
import { AdmissionsService } from './admissions.service';

const schoolUser = {
  id: 'admissions-1',
  role: 'ADMISSIONS',
  scope: 'SCHOOL' as const,
  schoolIds: ['school-a'],
  activeSchoolId: 'school-a',
};

function buildService() {
  const prisma = {
    applicant: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    class: { findUnique: jest.fn() },
  };
  const rabbitMq = { publish: jest.fn() };
  const studentsService = { create: jest.fn() };
  const authClient = { createStudentAccount: jest.fn(), ensureParentAccount: jest.fn() };
  const service = new AdmissionsService(
    prisma as any,
    rabbitMq as any,
    studentsService as any,
    authClient as any,
  );
  return { service, prisma, rabbitMq, studentsService, authClient };
}

describe('AdmissionsService residence and school boundaries', () => {
  it('stamps a classless inquiry with the selected school and residence choice', async () => {
    const { service, prisma } = buildService();
    prisma.applicant.create.mockResolvedValue({ id: 'applicant-1', stage: AdmissionStage.INQUIRY });

    await service.create(
      {
        firstName: 'Asha',
        lastName: 'Mushi',
        guardianFirstName: 'Neema',
        guardianLastName: 'Mushi',
        guardianPhone: '0712345678',
        residenceType: ResidenceType.BOARDING,
      },
      schoolUser.id,
      schoolUser,
    );

    expect(prisma.applicant.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolId: 'school-a',
        residenceType: ResidenceType.BOARDING,
        guardianPhone: '+255712345678',
      }),
    }));
  });

  it('requires a group user to select a school before a classless inquiry', async () => {
    const { service, prisma } = buildService();
    await expect(service.create(
      {
        firstName: 'Asha',
        lastName: 'Mushi',
        guardianFirstName: 'Neema',
        guardianLastName: 'Mushi',
        guardianPhone: '0712345678',
      },
      'group-admin',
      { id: 'group-admin', role: 'SYSTEM_ADMIN', scope: 'GROUP', schoolIds: ['*'] },
    )).rejects.toThrow(BadRequestException);
    expect(prisma.applicant.create).not.toHaveBeenCalled();
  });

  it('rejects direct applicant access outside the selected school', async () => {
    const { service, prisma } = buildService();
    prisma.applicant.findUnique.mockResolvedValue({ id: 'applicant-b', schoolId: 'school-b' });
    await expect(service.findById('applicant-b', schoolUser)).rejects.toThrow(ForbiddenException);
  });

  it('does not convert an accepted applicant until residence type is resolved', async () => {
    const { service, prisma, studentsService, authClient } = buildService();
    prisma.applicant.findUnique.mockResolvedValue({
      id: 'applicant-1',
      schoolId: 'school-a',
      stage: AdmissionStage.ACCEPTED,
      studentId: null,
      dateOfBirth: new Date('2012-01-02'),
      gender: Gender.FEMALE,
      residenceType: null,
      prospectiveClassId: 'class-a',
      offer: null,
      stageEvents: [],
      assessments: [],
      prospectiveClass: null,
    });

    await expect(service.convert('applicant-1', {}, schoolUser.id, schoolUser))
      .rejects.toThrow('Boarding or Day Scholar classification is required before enrolment');
    expect(prisma.class.findUnique).not.toHaveBeenCalled();
    expect(authClient.createStudentAccount).not.toHaveBeenCalled();
    expect(studentsService.create).not.toHaveBeenCalled();
  });
});
