import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES } from '../common/constants/roles';
import { CreateClassSubjectDto } from './dto/create-class-subject.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateClassSubjectDto } from './dto/update-class-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectsService } from './subjects.service';

@ApiTags('Academic - Subjects')
@Controller('academics')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post('subjects')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.subjectsService.createSubject(dto);
  }

  @Get('subjects')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
  )
  listSubjects(@Query('isActive') isActive?: string, @Query('isCompulsory') isCompulsory?: string) {
    return this.subjectsService.listSubjects({ isActive, isCompulsory });
  }

  @Patch('subjects/:id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  updateSubject(@Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return this.subjectsService.updateSubject(id, dto);
  }

  @Post('class-subjects')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  createClassSubject(@Body() dto: CreateClassSubjectDto) {
    return this.subjectsService.createClassSubject(dto);
  }

  @Get('class-subjects')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
  )
  listClassSubjects(
    @Query('classId') classId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.subjectsService.listClassSubjects({ classId, academicYearId, teacherId, subjectId });
  }

  @Patch('class-subjects/:id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  updateClassSubject(@Param('id') id: string, @Body() dto: UpdateClassSubjectDto) {
    return this.subjectsService.updateClassSubject(id, dto);
  }
}
