import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateSyllabusDto } from './dto/create-syllabus.dto';
import { UpdateSyllabusDto } from './dto/update-syllabus.dto';
import { SyllabusService } from './syllabus.service';

@ApiTags('Academic - Syllabus')
@Controller('academics/syllabus')
export class SyllabusController {
  constructor(private readonly syllabusService: SyllabusService) {}

  @Post()
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  create(@Body() dto: CreateSyllabusDto, @CurrentUser() user?: RequestUser) {
    return this.syllabusService.create(dto, user!);
  }

  @Patch(':id')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  update(@Param('id') id: string, @Body() dto: UpdateSyllabusDto, @CurrentUser() user?: RequestUser) {
    return this.syllabusService.update(id, dto, user!);
  }

  @Get()
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
  )
  list(
    @Query('classId') classId?: string,
    @Query('termId') termId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.syllabusService.list({ classId, termId, teacherId, subjectId });
  }
}
