import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DisciplineService } from './discipline.service';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { ResolveDisciplineDto } from './dto/resolve-discipline.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';

@ApiTags('Discipline')
@Controller('students')
@UseGuards(RolesGuard)
@ApiBearerAuth()
export class DisciplineController {
  constructor(private readonly disciplineService: DisciplineService) {}

  @Post('discipline')
  @Roles('TEACHER', 'HEAD_OF_DEPARTMENT', 'PRINCIPAL', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Record discipline incident' })
  async create(@Body() dto: CreateDisciplineDto, @CurrentUser() user?: RequestUser) {
    return this.disciplineService.create(dto, user?.id || 'system');
  }

  @Get('discipline')
  @Roles('PRINCIPAL', 'HEAD_OF_DEPARTMENT', 'ACADEMIC_QA', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'List discipline records with filters' })
  async list(
    @Query('studentId') studentId?: string,
    @Query('category') category?: any,
    @Query('severity') severity?: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.disciplineService.list({ studentId, category, severity, startDate, endDate });
  }

  @Get('discipline/:studentId')
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
  @ApiOperation({ summary: 'List one student discipline history' })
  async studentRecords(@Param('studentId') studentId: string, @CurrentUser() user?: RequestUser) {
    return this.disciplineService.studentRecords(studentId, user);
  }

  @Patch('discipline/:recordId/resolve')
  @Roles('PRINCIPAL', 'HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Resolve discipline record' })
  async resolve(@Param('recordId') recordId: string, @Body() dto: ResolveDisciplineDto) {
    return this.disciplineService.resolve(recordId, dto);
  }
}
