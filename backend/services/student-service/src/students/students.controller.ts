import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsDto } from './dto/list-students.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';
import { AccessControlService } from '../common/helpers/access-control.service';

@ApiTags('Students')
@Controller('students')
@UseGuards(RolesGuard)
@ApiBearerAuth()
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly accessControl: AccessControlService,
  ) {}

  private async assertScopedAccess(user: RequestUser, studentId: string): Promise<void> {
    if (user.role === 'PARENT') {
      await this.accessControl.assertParentOwnsStudent(user.id, studentId);
    }
    if (user.role === 'STUDENT') {
      await this.accessControl.assertStudentOwnsRecord(user.id, studentId);
    }
  }

  @Post()
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Enroll a new student' })
  async create(@Body() dto: CreateStudentDto, @CurrentUser() user?: RequestUser) {
    return this.studentsService.create(dto, user?.id || 'system');
  }

  @Get()
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'FINANCE', 'HEAD_OF_DEPARTMENT', 'TEACHER')
  async list(@Query() query: ListStudentsDto) {
    return this.studentsService.list(query);
  }

  @Get('registration/:registrationNumber')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'FINANCE', 'HEAD_OF_DEPARTMENT', 'TEACHER')
  async byRegistration(@Param('registrationNumber') registrationNumber: string) {
    return this.studentsService.findByRegistration(registrationNumber);
  }

  @Get(':id([0-9a-fA-F-]{36})')
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
  async byId(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    if (user) {
      await this.assertScopedAccess(user, id);
    }
    return this.studentsService.findById(id);
  }

  @Patch(':id([0-9a-fA-F-]{36})')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  async update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, dto);
  }

  @Patch(':id([0-9a-fA-F-]{36})/status')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  async status(@Param('id') id: string, @Body() dto: ChangeStatusDto, @CurrentUser() user?: RequestUser) {
    return this.studentsService.changeStatus(id, dto, user?.id || 'system');
  }

  @Post(':id([0-9a-fA-F-]{36})/promote')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  async promote(@Param('id') id: string, @Body() dto: PromoteStudentDto, @CurrentUser() user?: RequestUser) {
    return this.studentsService.promote(id, dto, user?.id || 'system');
  }
}
