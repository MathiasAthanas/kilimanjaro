import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { HostelLeaveStatus, RollCallSession } from '../../generated/prisma';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { BoardingService } from './boarding.service';
import { AssignDormitoryStaffDto, AssignDormitoryStudentDto, CreateDormitoryDto, CreateStudentLeaveDto, RecordRollCallDto, TransitionStudentLeaveDto, UpdateBedDto, UpdateDormitoryDto } from './boarding.dto';

const BOARDING_READ = ['MATRON', 'PATRON', 'SYSTEM_ADMIN', 'PRINCIPAL', 'HEAD_OF_SCHOOL', 'MANAGER', 'SUPER_ADMIN'] as const;
const BOARDING_ADMIN = ['SYSTEM_ADMIN', 'PRINCIPAL', 'HEAD_OF_SCHOOL', 'MANAGER', 'SUPER_ADMIN'] as const;

@Controller('boarding')
@UseGuards(RolesGuard)
export class BoardingController {
  constructor(private readonly service: BoardingService) {}

  @Get('dashboard') @Roles(...BOARDING_READ)
  dashboard(@CurrentUser() user?: RequestUser) { return this.service.dashboard(user); }

  @Get('awaiting') @Roles(...BOARDING_READ)
  awaiting(@CurrentUser() user?: RequestUser) { return this.service.awaiting(user); }

  @Get('dormitories') @Roles(...BOARDING_READ)
  dormitories(@CurrentUser() user?: RequestUser) { return this.service.listDormitories(user); }

  @Post('dormitories') @Roles(...BOARDING_ADMIN)
  createDormitory(@Body() dto: CreateDormitoryDto, @CurrentUser() user?: RequestUser) { return this.service.createDormitory(dto, user?.id || 'system', user); }

  @Get('dormitories/:id') @Roles(...BOARDING_READ)
  dormitory(@Param('id') id: string, @CurrentUser() user?: RequestUser) { return this.service.detail(id, user); }

  @Patch('dormitories/:id') @Roles(...BOARDING_ADMIN)
  updateDormitory(@Param('id') id: string, @Body() dto: UpdateDormitoryDto, @CurrentUser() user?: RequestUser) { return this.service.updateDormitory(id, dto, user); }

  @Post('dormitories/:id/staff') @Roles(...BOARDING_ADMIN)
  assignStaff(@Param('id') id: string, @Body() dto: AssignDormitoryStaffDto, @CurrentUser() user?: RequestUser) { return this.service.assignStaff(id, dto, user?.id || 'system', user); }

  @Patch('dormitories/:id/staff/:staffUserId/end') @Roles(...BOARDING_ADMIN)
  unassignStaff(@Param('id') id: string, @Param('staffUserId') staffUserId: string, @CurrentUser() user?: RequestUser) { return this.service.unassignStaff(id, staffUserId, user); }

  @Post('dormitories/:id/students') @Roles(...BOARDING_READ)
  assignStudent(@Param('id') id: string, @Body() dto: AssignDormitoryStudentDto, @CurrentUser() user?: RequestUser) { return this.service.assignStudent(id, dto, user?.id || 'system', user); }

  @Patch('dormitories/:id/students/:studentId/end') @Roles(...BOARDING_READ)
  unassignStudent(@Param('id') id: string, @Param('studentId') studentId: string, @CurrentUser() user?: RequestUser) { return this.service.unassignStudent(id, studentId, user); }

  @Patch('dormitories/:id/beds/:bedId') @Roles(...BOARDING_ADMIN)
  updateBed(@Param('id') id: string, @Param('bedId') bedId: string, @Body() dto: UpdateBedDto, @CurrentUser() user?: RequestUser) { return this.service.updateBed(id, bedId, dto.status, user); }

  @Post('dormitories/:id/roll-call') @Roles(...BOARDING_READ)
  rollCall(@Param('id') id: string, @Body() dto: RecordRollCallDto, @CurrentUser() user?: RequestUser) { return this.service.recordRollCall(id, dto, user?.id || 'system', user); }

  @Get('roll-calls') @Roles(...BOARDING_READ)
  rollCallHistory(@Query('dormitoryId') dormitoryId: string | undefined, @CurrentUser() user?: RequestUser) { return this.service.listRollCalls(user, dormitoryId); }

  @Get('roll-calls/:dormitoryId/:date/:session') @Roles(...BOARDING_READ)
  rollCallDetail(@Param('dormitoryId') dormitoryId: string, @Param('date') date: string, @Param('session') session: RollCallSession, @CurrentUser() user?: RequestUser) {
    return this.service.rollCallDetail(dormitoryId, date, session, user);
  }

  @Get('leaves') @Roles(...BOARDING_READ)
  leaves(@Query('status') status: HostelLeaveStatus | undefined, @CurrentUser() user?: RequestUser) { return this.service.listLeaves(user, status); }

  @Post('leaves') @Roles(...BOARDING_READ)
  createLeave(@Body() dto: CreateStudentLeaveDto, @CurrentUser() user?: RequestUser) { return this.service.createLeave(dto, user?.id || 'system', user); }

  @Patch('leaves/:id/status') @Roles(...BOARDING_READ)
  transitionLeave(@Param('id') id: string, @Body() dto: TransitionStudentLeaveDto, @CurrentUser() user?: RequestUser) { return this.service.transitionLeave(id, dto, user?.id || 'system', user); }
}
