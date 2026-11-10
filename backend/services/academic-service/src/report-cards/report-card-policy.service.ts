import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { requireWriteSchoolId, resolveWriteSchoolId } from '../common/helpers/school-scope.helper';
import { UpdateReportCardPolicyDto } from './dto/update-report-card-policy.dto';

export type ReportCardPolicyValues = {
  schoolId: string | null;
  primaryPassMark: number;
  oLevelPassMark: number;
  aLevelPassMark: number;
  showSubjectSupport: boolean;
  hideExemptSubjects: boolean;
  autoAlternativeSubjectExemptions: boolean;
  requiresSchoolSelection?: boolean;
};

export type AlternativeSubjectRow = {
  subjectId: string;
  subjectName: string;
  resultStatus?: string | null;
  status?: string | null;
};

export const DEFAULT_REPORT_CARD_POLICY: Omit<ReportCardPolicyValues, 'schoolId'> = {
  primaryPassMark: 50,
  oLevelPassMark: 40,
  aLevelPassMark: 25,
  showSubjectSupport: true,
  hideExemptSubjects: true,
  autoAlternativeSubjectExemptions: true,
};

const normalizeSubject = (value: string) => value.toUpperCase().replace(/[^A-Z]/g, '');

const alternativeKind = (name: string): 'IRE' | 'CRE' | null => {
  const normalized = normalizeSubject(name);
  if (normalized === 'IRE' || normalized.includes('ISLAMICRELIGIOUSEDUCATION')) return 'IRE';
  if (normalized === 'CRE' || normalized.includes('CHRISTIANRELIGIOUSEDUCATION')) return 'CRE';
  return null;
};

@Injectable()
export class ReportCardPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getForSchool(schoolId: string | null): Promise<ReportCardPolicyValues> {
    if (!schoolId) return { schoolId: null, ...DEFAULT_REPORT_CARD_POLICY };
    const stored = await this.prisma.reportCardPolicy.findUnique({ where: { schoolId } });
    return stored
      ? {
          schoolId,
          primaryPassMark: stored.primaryPassMark,
          oLevelPassMark: stored.oLevelPassMark,
          aLevelPassMark: stored.aLevelPassMark,
          showSubjectSupport: stored.showSubjectSupport,
          hideExemptSubjects: stored.hideExemptSubjects,
          autoAlternativeSubjectExemptions: stored.autoAlternativeSubjectExemptions,
        }
      : { schoolId, ...DEFAULT_REPORT_CARD_POLICY };
  }

  async getForUser(user: RequestUser): Promise<ReportCardPolicyValues> {
    const schoolId = resolveWriteSchoolId(user);
    return {
      ...(await this.getForSchool(schoolId)),
      requiresSchoolSelection: !schoolId,
    };
  }

  async update(dto: UpdateReportCardPolicyDto, user: RequestUser): Promise<ReportCardPolicyValues> {
    const schoolId = requireWriteSchoolId(user, 'report-card configuration');
    const current = await this.getForSchool(schoolId);
    const values = {
      primaryPassMark: dto.primaryPassMark ?? current.primaryPassMark,
      oLevelPassMark: dto.oLevelPassMark ?? current.oLevelPassMark,
      aLevelPassMark: dto.aLevelPassMark ?? current.aLevelPassMark,
      showSubjectSupport: dto.showSubjectSupport ?? current.showSubjectSupport,
      hideExemptSubjects: dto.hideExemptSubjects ?? current.hideExemptSubjects,
      autoAlternativeSubjectExemptions:
        dto.autoAlternativeSubjectExemptions ?? current.autoAlternativeSubjectExemptions,
      updatedById: user.id,
    };
    await this.prisma.reportCardPolicy.upsert({
      where: { schoolId },
      create: { schoolId, ...values },
      update: values,
    });
    return this.getForSchool(schoolId);
  }

  passMarkForStage(policy: ReportCardPolicyValues, stage: string | null | undefined): number {
    if (stage === 'A_LEVEL') return policy.aLevelPassMark;
    if (stage === 'O_LEVEL') return policy.oLevelPassMark;
    return policy.primaryPassMark;
  }

  alternativeDecision(rows: AlternativeSubjectRow[]): {
    exemptSubjectIds: string[];
    conflicts: string[];
  } {
    const ire = rows.filter((row) => alternativeKind(row.subjectName) === 'IRE');
    const cre = rows.filter((row) => alternativeKind(row.subjectName) === 'CRE');
    const statusOf = (row: AlternativeSubjectRow) => row.resultStatus ?? row.status ?? 'SCORED';
    const ireScored = ire.some((row) => statusOf(row) === 'SCORED');
    const creScored = cre.some((row) => statusOf(row) === 'SCORED');

    if (ireScored && creScored) {
      return { exemptSubjectIds: [], conflicts: ['Both alternative subjects contain scored results'] };
    }
    if (ireScored) {
      return {
        exemptSubjectIds: cre.filter((row) => statusOf(row) !== 'SCORED').map((row) => row.subjectId),
        conflicts: [],
      };
    }
    if (creScored) {
      return {
        exemptSubjectIds: ire.filter((row) => statusOf(row) !== 'SCORED').map((row) => row.subjectId),
        conflicts: [],
      };
    }
    return { exemptSubjectIds: [], conflicts: [] };
  }
}
