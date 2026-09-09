import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AdmissionOfferDecision,
  AdmissionStage,
  Applicant,
  GuardianRelationship,
  Prisma,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { StudentsService } from '../students/students.service';
import { buildPageMeta, paginate } from '../common/helpers/pagination.helper';
import { AuthClientService } from './auth-client.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { UpdateApplicantDto } from './dto/update-applicant.dto';
import { ListApplicantsDto } from './dto/list-applicants.dto';
import { TransitionStageDto } from './dto/transition-stage.dto';
import { RecordAssessmentDto, ScheduleAssessmentDto } from './dto/assessment.dto';
import { IssueOfferDto, OfferDecisionDto } from './dto/offer.dto';
import { ConvertApplicantDto } from './dto/convert-applicant.dto';

/** Allowed pipeline moves. ENROLLED is only reachable through convert(). */
const STAGE_TRANSITIONS: Record<AdmissionStage, AdmissionStage[]> = {
  INQUIRY: [AdmissionStage.APPLICATION, AdmissionStage.REJECTED, AdmissionStage.WITHDRAWN],
  APPLICATION: [AdmissionStage.ASSESSMENT, AdmissionStage.OFFER, AdmissionStage.REJECTED, AdmissionStage.WITHDRAWN],
  ASSESSMENT: [AdmissionStage.OFFER, AdmissionStage.REJECTED, AdmissionStage.WITHDRAWN],
  OFFER: [AdmissionStage.ACCEPTED, AdmissionStage.REJECTED, AdmissionStage.WITHDRAWN],
  ACCEPTED: [AdmissionStage.WITHDRAWN],
  ENROLLED: [],
  REJECTED: [],
  WITHDRAWN: [AdmissionStage.INQUIRY],
};

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
    private readonly studentsService: StudentsService,
    private readonly authClient: AuthClientService,
  ) {}

  /** Same normalisation scheme as auth-service and the dashboard CSV import. */
  static normalisePhone(phone: string): string {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.startsWith('255')) return `+${digits}`;
    if (digits.startsWith('0')) return `+255${digits.slice(1)}`;
    if (digits.length === 9) return `+255${digits}`;
    return `+${digits}`;
  }

  private applicantInclude() {
    return {
      prospectiveClass: { select: { id: true, name: true, stream: true, level: true, educationStage: true, capacity: true, academicYearId: true } },
      stageEvents: { orderBy: { createdAt: 'desc' as const } },
      assessments: { orderBy: { scheduledAt: 'desc' as const } },
      offer: true,
    };
  }

  async create(dto: CreateApplicantDto, actorId: string) {
    let schoolId: string | null = null;
    if (dto.prospectiveClassId) {
      const cls = await this.prisma.class.findUnique({ where: { id: dto.prospectiveClassId } });
      if (!cls) throw new BadRequestException('Prospective class not found');
      schoolId = cls.schoolId ?? null;
    }

    const applicant = await this.prisma.applicant.create({
      data: {
        firstName: dto.firstName,
        middleName: dto.middleName,
        lastName: dto.lastName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        nationality: dto.nationality || 'Tanzanian',
        previousSchool: dto.previousSchool,
        prospectiveClassId: dto.prospectiveClassId,
        educationStage: dto.educationStage,
        guardianFirstName: dto.guardianFirstName,
        guardianLastName: dto.guardianLastName,
        guardianPhone: AdmissionsService.normalisePhone(dto.guardianPhone),
        guardianEmail: dto.guardianEmail,
        guardianRelationship: dto.guardianRelationship || GuardianRelationship.GUARDIAN,
        sourceChannel: dto.sourceChannel,
        notes: dto.notes,
        schoolId,
        createdBy: actorId,
        stageEvents: {
          create: {
            fromStage: null,
            toStage: AdmissionStage.INQUIRY,
            actorId,
            note: 'Inquiry captured',
          },
        },
      },
      include: this.applicantInclude(),
    });

    await this.rabbitMq.publish('admissions.applicant.created', {
      applicantId: applicant.id,
      stage: applicant.stage,
      createdBy: actorId,
    });

    return applicant;
  }

  async list(query: ListApplicantsDto, user?: RequestUser) {
    const pagination = paginate(query.page, query.limit);
    const schoolId = user?.scope === 'SCHOOL' ? (user.activeSchoolId ?? user.schoolIds?.find((id) => id !== '*') ?? null) : null;

    const where: Prisma.ApplicantWhereInput = {
      ...(schoolId ? { schoolId } : {}),
      stage: query.stage,
      sourceChannel: query.sourceChannel,
      prospectiveClassId: query.prospectiveClassId,
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { middleName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { guardianFirstName: { contains: query.search, mode: 'insensitive' } },
              { guardianLastName: { contains: query.search, mode: 'insensitive' } },
              { guardianPhone: { contains: query.search.replace(/[^\d+]/g, '') || query.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.applicant.findMany({
        where,
        include: {
          prospectiveClass: { select: { id: true, name: true, stream: true, level: true } },
          offer: { select: { id: true, decision: true, classId: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.applicant.count({ where }),
    ]);

    return { items, meta: buildPageMeta(pagination.page, pagination.limit, total) };
  }

  async findById(id: string) {
    const applicant = await this.prisma.applicant.findUnique({
      where: { id },
      include: this.applicantInclude(),
    });
    if (!applicant) throw new NotFoundException('Applicant not found');
    return applicant;
  }

  async update(id: string, dto: UpdateApplicantDto) {
    const existing = await this.findById(id);
    if (existing.stage === AdmissionStage.ENROLLED) {
      throw new BadRequestException('Enrolled applicants can no longer be edited — update the student record instead');
    }
    if (dto.prospectiveClassId) {
      const cls = await this.prisma.class.findUnique({ where: { id: dto.prospectiveClassId } });
      if (!cls) throw new BadRequestException('Prospective class not found');
    }

    return this.prisma.applicant.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        middleName: dto.middleName,
        lastName: dto.lastName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        nationality: dto.nationality,
        previousSchool: dto.previousSchool,
        prospectiveClassId: dto.prospectiveClassId,
        educationStage: dto.educationStage,
        guardianFirstName: dto.guardianFirstName,
        guardianLastName: dto.guardianLastName,
        guardianPhone: dto.guardianPhone ? AdmissionsService.normalisePhone(dto.guardianPhone) : undefined,
        guardianEmail: dto.guardianEmail,
        guardianRelationship: dto.guardianRelationship,
        sourceChannel: dto.sourceChannel,
        notes: dto.notes,
      },
      include: this.applicantInclude(),
    });
  }

  async transition(id: string, dto: TransitionStageDto, actorId: string) {
    const applicant = await this.findById(id);

    if (dto.toStage === AdmissionStage.ENROLLED) {
      throw new BadRequestException('Use the convert endpoint to enrol an applicant');
    }

    const allowed = STAGE_TRANSITIONS[applicant.stage] || [];
    if (!allowed.includes(dto.toStage)) {
      throw new BadRequestException(
        `Cannot move applicant from ${applicant.stage} to ${dto.toStage}`,
      );
    }

    const updated = await this.prisma.applicant.update({
      where: { id },
      data: {
        stage: dto.toStage,
        stageEvents: {
          create: {
            fromStage: applicant.stage,
            toStage: dto.toStage,
            actorId,
            note: dto.note,
          },
        },
      },
      include: this.applicantInclude(),
    });

    await this.rabbitMq.publish('admissions.stage.changed', {
      applicantId: id,
      fromStage: applicant.stage,
      toStage: dto.toStage,
      actorId,
    });

    return updated;
  }

  async scheduleAssessment(applicantId: string, dto: ScheduleAssessmentDto, actorId: string) {
    const applicant = await this.findById(applicantId);

    const assessment = await this.prisma.admissionAssessment.create({
      data: {
        applicantId,
        scheduledAt: new Date(dto.scheduledAt),
        subjectFocus: dto.subjectFocus,
        maxScore: dto.maxScore ?? 100,
        notes: dto.notes,
        recordedBy: actorId,
      },
    });

    // Scheduling an assessment implicitly moves an APPLICATION forward
    if (applicant.stage === AdmissionStage.APPLICATION) {
      await this.transition(applicantId, { toStage: AdmissionStage.ASSESSMENT, note: 'Entrance assessment scheduled' }, actorId);
    }

    return assessment;
  }

  async recordAssessment(assessmentId: string, dto: RecordAssessmentDto, actorId: string) {
    const assessment = await this.prisma.admissionAssessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException('Assessment not found');

    return this.prisma.admissionAssessment.update({
      where: { id: assessmentId },
      data: {
        score: dto.score,
        outcome: dto.outcome,
        notes: dto.notes,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        recordedBy: actorId,
      },
    });
  }

  async issueOffer(applicantId: string, dto: IssueOfferDto, actorId: string) {
    const applicant = await this.findById(applicantId);
    const offerableStages: AdmissionStage[] = [AdmissionStage.APPLICATION, AdmissionStage.ASSESSMENT, AdmissionStage.OFFER];
    if (!offerableStages.includes(applicant.stage)) {
      throw new BadRequestException(`Cannot issue an offer while applicant is in ${applicant.stage}`);
    }

    const cls = await this.prisma.class.findUnique({ where: { id: dto.classId } });
    if (!cls) throw new BadRequestException('Offered class not found');

    const offer = await this.prisma.admissionOffer.upsert({
      where: { applicantId },
      create: {
        applicantId,
        classId: dto.classId,
        feeExpectation: dto.feeExpectation,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        note: dto.note,
        issuedBy: actorId,
      },
      update: {
        classId: dto.classId,
        feeExpectation: dto.feeExpectation,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        note: dto.note,
        issuedBy: actorId,
        decision: AdmissionOfferDecision.PENDING,
        respondedAt: null,
      },
    });

    // Update prospective class to match the offer and advance the stage
    await this.prisma.applicant.update({ where: { id: applicantId }, data: { prospectiveClassId: dto.classId } });
    if (applicant.stage !== AdmissionStage.OFFER) {
      await this.transition(applicantId, { toStage: AdmissionStage.OFFER, note: 'Admission offer issued' }, actorId);
    }

    return offer;
  }

  async decideOffer(applicantId: string, dto: OfferDecisionDto, actorId: string) {
    const applicant = await this.findById(applicantId);
    if (!applicant.offer) throw new BadRequestException('No offer has been issued for this applicant');
    if (applicant.stage !== AdmissionStage.OFFER) {
      throw new BadRequestException(`Offer decisions require the applicant to be in OFFER stage (currently ${applicant.stage})`);
    }

    await this.prisma.admissionOffer.update({
      where: { applicantId },
      data: {
        decision: dto.decision === 'ACCEPTED' ? AdmissionOfferDecision.ACCEPTED : AdmissionOfferDecision.DECLINED,
        respondedAt: new Date(),
      },
    });

    const toStage = dto.decision === 'ACCEPTED' ? AdmissionStage.ACCEPTED : AdmissionStage.WITHDRAWN;
    return this.transition(
      applicantId,
      { toStage, note: dto.note || `Offer ${dto.decision.toLowerCase()} by guardian` },
      actorId,
    );
  }

  /**
   * Convert an ACCEPTED applicant into an enrolled student.
   * Reuses the exact same pipeline as the bulk CSV import:
   *  1. create STUDENT auth account (auth internal API)
   *  2. find-or-create PARENT auth account deduplicated by phone
   *  3. StudentsService.create → student + enrolment + guardian link +
   *     `student.enrolled` event (finance invoice + welcome notification react)
   *  4. back-fill the registration number onto the student auth account
   */
  async convert(applicantId: string, dto: ConvertApplicantDto, actorId: string) {
    const applicant = await this.findById(applicantId);

    if (applicant.stage !== AdmissionStage.ACCEPTED) {
      throw new BadRequestException('Only applicants in ACCEPTED stage can be enrolled');
    }
    if (applicant.studentId) {
      throw new ConflictException('Applicant has already been enrolled');
    }
    if (!applicant.dateOfBirth || !applicant.gender) {
      throw new BadRequestException('Date of birth and gender are required before enrolment — edit the applicant first');
    }

    const classId = applicant.offer?.classId || applicant.prospectiveClassId;
    if (!classId) {
      throw new BadRequestException('No target class — issue an offer or set a prospective class first');
    }
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new BadRequestException('Target class no longer exists');

    const studentAccount = await this.authClient.createStudentAccount({
      firstName: applicant.firstName,
      lastName: applicant.lastName,
      actorId,
      schoolId: cls.schoolId ?? (() => { throw new BadRequestException('Target class must belong to a school'); })(),
    });

    const parentAccount = await this.authClient.ensureParentAccount({
      firstName: applicant.guardianFirstName,
      lastName: applicant.guardianLastName,
      phoneNumber: applicant.guardianPhone,
      email: applicant.guardianEmail || undefined,
      actorId,
      schoolId: cls.schoolId ?? (() => { throw new BadRequestException('Target class must belong to a school'); })(),
    });

    // Create the student, recovering safely if a prior partial convert() already created the row.
    // studentsService.create() is inside a transaction and enforces authUserId @unique; a P2002
    // means an earlier run crashed after creating the student but before updating the applicant.
    let student: { id: string; registrationNumber: string };
    try {
      student = (await this.studentsService.create(
        {
          authUserId: studentAccount.id,
          firstName: applicant.firstName,
          middleName: applicant.middleName || undefined,
          lastName: applicant.lastName,
          dateOfBirth: applicant.dateOfBirth.toISOString().slice(0, 10),
          gender: applicant.gender,
          nationality: applicant.nationality,
          admissionDate: dto.admissionDate || new Date().toISOString().slice(0, 10),
          classId,
          academicYearId: cls.academicYearId,
          guardians: [
            {
              authUserId: parentAccount.id,
              firstName: applicant.guardianFirstName,
              lastName: applicant.guardianLastName,
              relationship: applicant.guardianRelationship,
              phoneNumber: parentAccount.phoneNumber,
              email: applicant.guardianEmail || undefined,
              isPrimary: true,
            },
          ],
        },
        actorId,
      )) as { id: string; registrationNumber: string };
    } catch (err: unknown) {
      // P2002 = unique constraint on authUserId: student was created in a prior partial attempt.
      // Recover by fetching the existing row rather than double-creating.
      if ((err as any)?.code === 'P2002') {
        const existing = await this.prisma.student.findUnique({
          where: { authUserId: studentAccount.id },
          select: { id: true, registrationNumber: true },
        });
        if (!existing) throw err;
        student = existing;
      } else {
        throw err;
      }
    }

    if (student?.registrationNumber) {
      await this.authClient.setRegistrationNumber(studentAccount.id, student.registrationNumber, actorId);
      if (applicant.offer && !applicant.offer.admissionNumber) {
        await this.prisma.admissionOffer.update({
          where: { applicantId },
          data: { admissionNumber: student.registrationNumber },
        });
      }
    }

    const updated = await this.prisma.applicant.update({
      where: { id: applicantId },
      data: {
        stage: AdmissionStage.ENROLLED,
        studentId: student.id,
        stageEvents: {
          create: {
            fromStage: applicant.stage,
            toStage: AdmissionStage.ENROLLED,
            actorId,
            note: `Enrolled as ${student.registrationNumber}`,
          },
        },
      },
      include: this.applicantInclude(),
    });

    await this.rabbitMq.publish('admissions.applicant.enrolled', {
      applicantId,
      studentId: student.id,
      registrationNumber: student.registrationNumber,
      classId,
      actorId,
    });

    return { applicant: updated, student };
  }

  /**
   * Admissions analytics: funnel, conversion, source channels, intake and
   * seat capacity vs. filled per class (current academic year).
   */
  async analytics(user?: RequestUser) {
    const schoolId = user?.scope === 'SCHOOL' ? (user.activeSchoolId ?? user.schoolIds?.find((id) => id !== '*') ?? null) : null;
    const schoolFilter = schoolId ? { schoolId } : {};

    const [stageCounts, sourceCounts, currentYear] = await Promise.all([
      this.prisma.applicant.groupBy({ by: ['stage'], where: schoolFilter, _count: { _all: true } }),
      this.prisma.applicant.groupBy({ by: ['sourceChannel'], where: schoolFilter, _count: { _all: true } }),
      this.prisma.academicYear.findFirst({ where: { isCurrent: true } }),
    ]);

    const funnel = Object.values(AdmissionStage).map((stage) => ({
      stage,
      count: stageCounts.find((s) => s.stage === stage)?._count._all ?? 0,
    }));

    const total = funnel.reduce((sum, s) => sum + s.count, 0);
    const enrolled = funnel.find((s) => s.stage === AdmissionStage.ENROLLED)?.count ?? 0;
    const rejected = funnel.find((s) => s.stage === AdmissionStage.REJECTED)?.count ?? 0;
    const withdrawn = funnel.find((s) => s.stage === AdmissionStage.WITHDRAWN)?.count ?? 0;
    const active = total - enrolled - rejected - withdrawn;

    const sourceChannels = sourceCounts.map((s) => ({ channel: s.sourceChannel, count: s._count._all }));

    // Intake per prospective class (non-terminal pipeline + enrolled)
    const intakeRows = await this.prisma.applicant.groupBy({
      by: ['prospectiveClassId', 'stage'],
      _count: { _all: true },
      where: { prospectiveClassId: { not: null }, ...schoolFilter },
    });

    const classes = currentYear
      ? await this.prisma.class.findMany({
          where: { academicYearId: currentYear.id, ...schoolFilter },
          select: {
            id: true,
            name: true,
            stream: true,
            level: true,
            educationStage: true,
            capacity: true,
            _count: { select: { enrolments: { where: { isActive: true } } } },
          },
          orderBy: [{ level: 'asc' }, { name: 'asc' }],
        })
      : [];

    const terminalStages: AdmissionStage[] = [AdmissionStage.ENROLLED, AdmissionStage.REJECTED, AdmissionStage.WITHDRAWN];
    const capacity = classes.map((cls) => {
      const pipelineCount = intakeRows
        .filter((row) => row.prospectiveClassId === cls.id && !terminalStages.includes(row.stage))
        .reduce((sum, row) => sum + row._count._all, 0);
      const enrolledFromAdmissions = intakeRows
        .filter((row) => row.prospectiveClassId === cls.id && row.stage === AdmissionStage.ENROLLED)
        .reduce((sum, row) => sum + row._count._all, 0);
      const filled = cls._count.enrolments;
      return {
        classId: cls.id,
        className: cls.stream ? `${cls.name} ${cls.stream}` : cls.name,
        level: cls.level,
        educationStage: cls.educationStage,
        capacity: cls.capacity,
        filled,
        available: Math.max(cls.capacity - filled, 0),
        pipeline: pipelineCount,
        enrolledFromAdmissions,
      };
    });

    return {
      funnel,
      totals: {
        total,
        active,
        enrolled,
        rejected,
        withdrawn,
        conversionRate: total > 0 ? Number(((enrolled / total) * 100).toFixed(1)) : 0,
      },
      sourceChannels,
      capacity,
      academicYear: currentYear ? { id: currentYear.id, name: currentYear.name } : null,
    };
  }
}
