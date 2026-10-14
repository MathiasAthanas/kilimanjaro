import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { DepartmentsService } from './departments.service';
import { AssignHodDto } from './dto/assign-hod.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';

@ApiTags('Departments')
@UseGuards(RolesGuard)
@Controller('students/departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Post()
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a department' })
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() user?: RequestUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT', 'TEACHER', 'FINANCE')
  @ApiOperation({ summary: 'List all departments' })
  list(@CurrentUser() user?: RequestUser) {
    return this.service.list(user);
  }

  @Patch(':id')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a department' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateDepartmentDto>, @CurrentUser() user?: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Delete a department' })
  remove(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.service.remove(id, user);
  }

  @Get('by-user/:userId')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT')
  @ApiOperation({ summary: "Get a user's HOD department assignment" })
  byUser(
    @Param('userId') userId: string,
    @Query('academicYearId') academicYearId?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.getDepartmentByUserId(userId, academicYearId, user);
  }

  @Post(':id/hods')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Assign a HOD to a department' })
  assignHod(@Param('id') id: string, @Body() dto: AssignHodDto, @CurrentUser() user?: RequestUser) {
    return this.service.assignHod(id, dto, user);
  }

  @Delete(':id/hods/:userId')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Remove a HOD from a department' })
  removeHod(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.removeHod(id, userId, academicYearId, user);
  }

  @Get(':id/hods')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT')
  @ApiOperation({ summary: 'List HODs for a department' })
  listHods(
    @Param('id') id: string,
    @Query('academicYearId') academicYearId?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.listHods(id, academicYearId, user);
  }
}
