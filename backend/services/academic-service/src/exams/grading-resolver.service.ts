import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface ResolvedGrade {
  grade: string;
  points: number;
  remark: string;
  isPassing: boolean;
}

export interface GradingScaleScope {
  educationStage?: string | null;
  classLevel?: number | null;
  subjectId?: string | null;
}

/**
 * Resolves the active grading scale for a given scope and maps a percentage
 * score onto a grade band. Shared by the exam-lifecycle services so the merit
 * list, report cards and per-subject results all grade identically.
 *
 * Precedence (most specific wins): school + subject + level + stage, falling
 * back through level, stage, and finally the global (schoolId = null) scale —
 * mirroring the precedence in ResultsService.getActiveScale.
 */
@Injectable()
export class GradingResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getActiveScale(
    academicYearId: string,
    scope: GradingScaleScope = {},
    schoolId?: string | null,
  ): Promise<any> {
    const cacheKey = `grading-scale:active:${schoolId ?? 'global'}:${academicYearId}:${scope.educationStage ?? 'ALL'}:${scope.classLevel ?? 'ALL'}:${scope.subjectId ?? 'ALL'}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const candidates = await this.prisma.gradingScale.findMany({
      where: {
        academicYearId,
        isActive: true,
        AND: [
          schoolId ? { OR: [{ schoolId }, { schoolId: null }] } : { schoolId: null },
          {
            OR: [
              { educationStage: scope.educationStage as any, classLevel: scope.classLevel ?? null, subjectId: scope.subjectId ?? null },
              { educationStage: scope.educationStage as any, classLevel: scope.classLevel ?? null, subjectId: null },
              { educationStage: scope.educationStage as any, classLevel: null, subjectId: null },
              { educationStage: null, classLevel: null, subjectId: null },
            ],
          },
        ],
      },
      include: { grades: { orderBy: { minScore: 'asc' } } },
    });

    const scale = candidates.sort((a, b) => {
      const score = (item: typeof a) =>
        (item.schoolId ? 8 : 0) +
        (item.subjectId ? 4 : 0) +
        (item.classLevel !== null ? 2 : 0) +
        (item.educationStage ? 1 : 0);
      return score(b) - score(a);
    })[0];

    if (!scale) {
      throw new BadRequestException(
        `No active grading scale for academic year. Create and activate a grading scale in Academic Setup first.`,
      );
    }

    await this.redis.set(cacheKey, scale, 3600);
    return scale;
  }

  /**
   * Map a 0–100 percentage onto the scale's grade band.
   *
   * Uses "highest minScore ≤ percentage" rather than a strict min..max window,
   * so fractional means that fall in a boundary gap (e.g. 79.6 between a band
   * ending at 79 and one starting at 80) still resolve to the correct upper
   * band instead of falling through to "not graded".
   */
  resolveGrade(scale: any, percentage: number): ResolvedGrade {
    const bands = (scale?.grades ?? []).slice().sort((a: any, b: any) => b.minScore - a.minScore);
    if (!bands.length) {
      return { grade: 'X', points: 0, remark: 'Not graded', isPassing: false };
    }
    // First band whose lower bound the score reaches; else the lowest band.
    const band = bands.find((b: any) => percentage >= b.minScore) ?? bands[bands.length - 1];
    return {
      grade: band.grade,
      points: band.points,
      remark: band.remark,
      isPassing: band.isPassing,
    };
  }

  /** Ordered list of grade codes for building distribution summaries (A,B,C,…,X). */
  gradeCodes(scale: any): string[] {
    const codes = (scale?.grades ?? [])
      .slice()
      .sort((a: any, b: any) => b.minScore - a.minScore)
      .map((g: any) => g.grade as string);
    return codes;
  }
}
