import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Academic - Internal')
@Controller('academics/internal')
@UseGuards(InternalApiGuard)
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('results/:studentId/term/:termId')
  async resultsByStudent(@Param('studentId') studentId: string, @Param('termId') termId: string) {
    return this.prisma.termResult.findMany({
      where: { studentId, termId },
      orderBy: { weightedTotal: 'desc' },
    });
  }

  @Get('class/:classId/term/:termId/published')
  async classTermPublished(@Param('classId') classId: string, @Param('termId') termId: string) {
    const total = await this.prisma.termResult.count({ where: { classId, termId } });
    const published = await this.prisma.termResult.count({ where: { classId, termId, isPublished: true } });
    return {
      classId,
      termId,
      total,
      published,
      isPublished: total > 0 && total === published,
    };
  }
}
