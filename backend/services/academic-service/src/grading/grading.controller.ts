import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
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
  listGradingScales(
    @Query('academicYearId') academicYearId?: string,
    @Query('educationStage') educationStage?: string,
    @Query('classLevel') classLevel?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.gradingService.listGradingScales({
      academicYearId,
      educationStage,
      classLevel: classLevel ? Number(classLevel) : undefined,
      subjectId,
    });
  }

  @Patch('grading-scales/:id/activate')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL)
  activateGradingScale(@Param('id') id: string) {
    return this.gradingService.activateGradingScale(id);
  }

  @Delete('grading-scales/:id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteGradingScale(@Param('id') id: string) {
    return this.gradingService.deleteGradingScale(id);
  }

  @Post('assessment-types')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  createAssessmentType(@Body() dto: CreateAssessmentTypeDto) {
    return this.gradingService.createAssessmentType(dto);
  }

  @Patch('assessment-types/:id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  updateAssessmentType(@Param('id') id: string, @Body() dto: Partial<CreateAssessmentTypeDto>) {
    return this.gradingService.updateAssessmentType(id, dto);
  }

  @Get('assessment-types')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
  )
  listAssessmentTypes(
    @Query('academicYearId') academicYearId?: string,
    @Query('educationStage') educationStage?: string,
    @Query('classLevel') classLevel?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.gradingService.listAssessmentTypes({
      academicYearId,
      educationStage,
      classLevel: classLevel ? Number(classLevel) : undefined,
      subjectId,
    });
  }
}
