import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateAssessmentTypeDto } from './dto/create-assessment-type.dto';
import { CreateGradingScaleDto } from './dto/create-grading-scale.dto';
import { GradingService } from './grading.service';

@ApiTags('Academic - Grading')
@Controller('academics')
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Post('grading-scales')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL)
  createGradingScale(@Body() dto: CreateGradingScaleDto) {
    return this.gradingService.createGradingScale(dto);
  }

  @Get('grading-scales')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
  )
  listGradingScales() {
    return this.gradingService.listGradingScales();
  }

  @Patch('grading-scales/:id/activate')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL)
  activateGradingScale(@Param('id') id: string) {
    return this.gradingService.activateGradingScale(id);
  }

  @Post('assessment-types')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  createAssessmentType(@Body() dto: CreateAssessmentTypeDto) {
    return this.gradingService.createAssessmentType(dto);
  }

  @Get('assessment-types')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
  )
  listAssessmentTypes(@Query('academicYearId') academicYearId?: string) {
    return this.gradingService.listAssessmentTypes(academicYearId);
  }
}
