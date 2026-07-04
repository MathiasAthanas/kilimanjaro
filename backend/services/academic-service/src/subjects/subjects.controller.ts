import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateClassSubjectDto } from './dto/create-class-subject.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateSubjectCombinationDto } from './dto/create-subject-combination.dto';
import { CreateStudentSubjectEnrollmentDto } from './dto/create-student-subject-enrollment.dto';
import { BulkStudentSubjectEnrollmentDto } from './dto/bulk-student-subject-enrollment.dto';
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
  listSubjects(
    @Query('isActive') isActive?: string,
    @Query('isCompulsory') isCompulsory?: string,
    @Query('educationStage') educationStage?: string,
  ) {
    return this.subjectsService.listSubjects({ isActive, isCompulsory, educationStage });
  }

  @Patch('subjects/:id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  updateSubject(@Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return this.subjectsService.updateSubject(id, dto);
  }

  @Delete('subjects/:id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSubject(@Param('id') id: string) {
    return this.subjectsService.deleteSubject(id);
  }

  @Post('class-subjects')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT)
  createClassSubject(@Body() dto: CreateClassSubjectDto, @CurrentUser() user?: RequestUser) {
    return this.subjectsService.createClassSubject(dto, user);
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
    @Query('educationStage') educationStage?: string,
    @Query('classLevel') classLevel?: string,
    @Query('combinationId') combinationId?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.subjectsService.listClassSubjects({
      classId,
      academicYearId,
      teacherId,
      subjectId,
      educationStage,
      classLevel: classLevel ? Number(classLevel) : undefined,
      combinationId,
    }, user);
  }

  @Patch('class-subjects/:id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT)
  updateClassSubject(@Param('id') id: string, @Body() dto: UpdateClassSubjectDto, @CurrentUser() user?: RequestUser) {
    return this.subjectsService.updateClassSubject(id, dto, user);
  }

  @Post('subject-combinations')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  createSubjectCombination(@Body() dto: CreateSubjectCombinationDto) {
    return this.subjectsService.createSubjectCombination(dto);
  }

  @Patch('subject-combinations/:id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  updateSubjectCombination(@Param('id') id: string, @Body() dto: Partial<CreateSubjectCombinationDto>) {
    return this.subjectsService.updateSubjectCombination(id, dto);
  }

  @Delete('subject-combinations/:id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  deactivateSubjectCombination(@Param('id') id: string) {
    return this.subjectsService.deactivateSubjectCombination(id);
  }

  @Get('subject-combinations')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT, ROLES.TEACHER)
  listSubjectCombinations(
    @Query('academicYearId') academicYearId?: string,
    @Query('educationStage') educationStage?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.subjectsService.listSubjectCombinations({ academicYearId, educationStage, isActive });
  }

  @Post('student-subject-enrollments')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  enrollStudentSubject(@Body() dto: CreateStudentSubjectEnrollmentDto) {
    return this.subjectsService.enrollStudentSubject(dto);
  }

  @Post('student-subject-enrollments/bulk-combination')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  bulkEnrollStudentCombination(@Body() dto: BulkStudentSubjectEnrollmentDto) {
    return this.subjectsService.bulkEnrollStudentCombination(dto);
  }

  @Patch('student-subject-enrollments/:id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  updateStudentSubjectEnrollment(@Param('id') id: string, @Body() dto: Partial<CreateStudentSubjectEnrollmentDto>) {
    return this.subjectsService.updateStudentSubjectEnrollment(id, dto);
  }

  @Delete('student-subject-enrollments/:id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  deactivateStudentSubjectEnrollment(@Param('id') id: string) {
    return this.subjectsService.deactivateStudentSubjectEnrollment(id);
  }

  @Get('student-subject-enrollments')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT, ROLES.TEACHER)
  listStudentSubjectEnrollments(
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('combinationId') combinationId?: string,
  ) {
    return this.subjectsService.listStudentSubjectEnrollments({
      studentId,
      classId,
      academicYearId,
      combinationId,
    });
  }
}
