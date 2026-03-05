import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';

@ApiTags('Attendance')
@Controller('students')
@UseGuards(RolesGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('attendance')
  @Roles('TEACHER', 'HEAD_OF_DEPARTMENT', 'PRINCIPAL')
  @ApiOperation({ summary: 'Mark attendance in bulk for a class/date' })
  async mark(@Body() dto: MarkAttendanceDto, @CurrentUser() user?: RequestUser) {
    return this.attendanceService.mark(dto, user?.id || 'system');
  }

  @Get('attendance')
  @Roles(
    'SYSTEM_ADMIN',
    'PRINCIPAL',
    'ACADEMIC_QA',
    'FINANCE',
    'HEAD_OF_DEPARTMENT',
    'TEACHER',
    'PARENT',
  )
  @ApiOperation({ summary: 'List attendance records with attendance rate' })
  async list(@Query() query: AttendanceFilterDto, @CurrentUser() user?: RequestUser) {
    return this.attendanceService.list(query, user);
  }

  @Get('attendance/summary/:studentId')
  @Roles(
    'SYSTEM_ADMIN',
    'PRINCIPAL',
    'ACADEMIC_QA',
    'FINANCE',
    'HEAD_OF_DEPARTMENT',
    'TEACHER',
    'PARENT',
    'STUDENT',
  )
  @ApiOperation({ summary: 'Per-term attendance summary for a student' })
  async summary(@Param('studentId') studentId: string, @CurrentUser() user?: RequestUser) {
    return this.attendanceService.summary(studentId, user);
  }
}
