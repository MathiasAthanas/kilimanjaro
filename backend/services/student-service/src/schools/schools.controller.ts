import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SchoolsService } from './schools.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateSchoolDto, SetSchoolStatusDto, UpdateSchoolDto } from './schools.dto';

const STRUCTURAL = ['SUPER_ADMIN'] as const;
const GROUP_READ = [
  'SUPER_ADMIN',
  'SYSTEM_ADMIN',
  'MANAGER',
  'HEAD_OF_FINANCE',
  'HEAD_OF_SCHOOL',
  'ACADEMIC_QA',
  'FINANCE',
  'HEAD_OF_DEPARTMENT',
  'TEACHER',
  'ADMISSIONS',
] as const;

@ApiTags('Schools')
@Controller('schools')
@UseGuards(RolesGuard)
@ApiBearerAuth()
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  @Roles(...STRUCTURAL)
  @ApiOperation({ summary: 'Create a school (Super Admin only)' })
  create(@Body() dto: CreateSchoolDto, @CurrentUser() user?: RequestUser) {
    return this.schoolsService.create(dto, user?.id || 'system');
  }

  @Get()
  @Roles(...GROUP_READ)
  @ApiOperation({ summary: 'List schools within the caller scope' })
  list(@CurrentUser() user?: RequestUser) {
    return this.schoolsService.list(user);
  }

  @Get(':id/summary')
  @Roles(...GROUP_READ)
  @ApiOperation({ summary: 'Headline counts for one school' })
  summary(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.schoolsService.summary(id, user);
  }

  @Get(':id')
  @Roles(...GROUP_READ)
  @ApiOperation({ summary: 'One school' })
  byId(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.schoolsService.findById(id, user);
  }

  @Patch(':id')
  @Roles(...STRUCTURAL)
  @ApiOperation({ summary: 'Edit a school (incl. gender, with narrowing guard)' })
  update(@Param('id') id: string, @Body() dto: UpdateSchoolDto, @CurrentUser() user?: RequestUser) {
    return this.schoolsService.update(id, dto, user?.id || 'system');
  }

  @Patch(':id/status')
  @Roles(...STRUCTURAL)
  @ApiOperation({ summary: 'Activate / deactivate a school' })
  setStatus(@Param('id') id: string, @Body() dto: SetSchoolStatusDto, @CurrentUser() user?: RequestUser) {
    return this.schoolsService.setStatus(id, dto.isActive, user?.id || 'system');
  }
}
