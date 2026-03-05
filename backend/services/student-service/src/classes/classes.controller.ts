import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClassesService } from './classes.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateTermDto } from './dto/create-term.dto';

@ApiTags('Class & Enrolment')
@Controller('students')
@UseGuards(RolesGuard)
@ApiBearerAuth()
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post('classes')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create class' })
  async createClass(@Body() dto: CreateClassDto) {
    return this.classesService.createClass(dto);
  }

  @Get('classes')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'FINANCE', 'HEAD_OF_DEPARTMENT', 'TEACHER')
  @ApiOperation({ summary: 'List classes by academic year/level/stream' })
  async listClasses(
    @Query('academicYearId') academicYearId?: string,
    @Query('level') level?: string,
    @Query('stream') stream?: string,
  ) {
    return this.classesService.listClasses({
      academicYearId,
      level: level ? Number(level) : undefined,
      stream,
    });
  }

  @Get('classes/:classId/students')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'FINANCE', 'HEAD_OF_DEPARTMENT', 'TEACHER')
  @ApiOperation({ summary: 'List active students in class' })
  async classStudents(@Param('classId') classId: string) {
    return this.classesService.classStudents(classId);
  }

  @Post('academic-years')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create academic year' })
  async createAcademicYear(@Body() dto: CreateAcademicYearDto) {
    return this.classesService.createAcademicYear(dto);
  }

  @Get('academic-years')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'FINANCE', 'HEAD_OF_DEPARTMENT', 'TEACHER')
  @ApiOperation({ summary: 'List academic years' })
  async listAcademicYears() {
    return this.classesService.listAcademicYears();
  }

  @Post('terms')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create term under academic year' })
  async createTerm(@Body() dto: CreateTermDto) {
    return this.classesService.createTerm(dto);
  }

  @Get('terms')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'FINANCE', 'HEAD_OF_DEPARTMENT', 'TEACHER')
  @ApiOperation({ summary: 'List terms by academic year/current flag' })
  async listTerms(@Query('academicYearId') academicYearId?: string, @Query('isCurrent') isCurrent?: string) {
    return this.classesService.listTerms({
      academicYearId,
      isCurrent: isCurrent === undefined ? undefined : isCurrent === 'true',
    });
  }
}
