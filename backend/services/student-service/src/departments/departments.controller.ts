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
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
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
  create(@Body() dto: CreateDepartmentDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT', 'TEACHER', 'FINANCE')
  @ApiOperation({ summary: 'List all departments' })
  list() {
    return this.service.list();
  }

  @Patch(':id')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a department' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateDepartmentDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Delete a department' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get('by-user/:userId')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT')
  @ApiOperation({ summary: "Get a user's HOD department assignment" })
  byUser(@Param('userId') userId: string, @Query('academicYearId') academicYearId?: string) {
    return this.service.getDepartmentByUserId(userId, academicYearId);
  }

  @Post(':id/hods')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Assign a HOD to a department' })
  assignHod(@Param('id') id: string, @Body() dto: AssignHodDto) {
    return this.service.assignHod(id, dto);
  }

  @Delete(':id/hods/:userId')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Remove a HOD from a department' })
  removeHod(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.service.removeHod(id, userId, academicYearId);
  }

  @Get(':id/hods')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT')
  @ApiOperation({ summary: 'List HODs for a department' })
  listHods(@Param('id') id: string, @Query('academicYearId') academicYearId?: string) {
    return this.service.listHods(id, academicYearId);
  }
}
