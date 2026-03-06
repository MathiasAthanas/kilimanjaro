import { Controller, Delete, Get, Param, Post, Query, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { TimetableService } from './timetable.service';

@ApiTags('Academic - Timetable')
@Controller('academics/timetables')
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Post()
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  create(@Body() dto: CreateTimetableDto) {
    return this.timetableService.create(dto);
  }

  @Get()
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
    ROLES.STUDENT,
  )
  list(
    @Query('classId') classId?: string,
    @Query('termId') termId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('dayOfWeek') dayOfWeek?: string,
  ) {
    return this.timetableService.list({ classId, termId, teacherId, dayOfWeek });
  }

  @Delete(':id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  remove(@Param('id') id: string) {
    return this.timetableService.delete(id);
  }
}
