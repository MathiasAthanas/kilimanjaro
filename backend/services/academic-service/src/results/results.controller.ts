import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PublishResultsDto } from './dto/publish-results.dto';
import { ResultsFilterDto } from './dto/results-filter.dto';
import { ResultsService } from './results.service';

@ApiTags('Academic - Results')
@Controller('academics')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get('results')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.STUDENT,
  )
  list(@Query() filters: ResultsFilterDto, @CurrentUser() user?: RequestUser) {
    return this.resultsService.listResults(filters, user);
  }

  @Get('results/class/:classId/term/:termId')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  classResults(@Param('classId') classId: string, @Param('termId') termId: string) {
    return this.resultsService.classResults(classId, termId);
  }

  @Post('results/publish')
  @Roles(ROLES.PRINCIPAL)
  publish(@Body() dto: PublishResultsDto, @CurrentUser() user?: RequestUser) {
    return this.resultsService.publishResults(dto, user!);
  }
}
