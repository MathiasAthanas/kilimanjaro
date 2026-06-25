import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClassesService } from './classes.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateTermDto } from './dto/create-term.dto';
import { CreateClassPathwayDto } from './dto/create-class-pathway.dto';

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

  @Patch('classes/:classId')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Update class setup and mixed-school stage metadata' })
  async updateClass(@Param('classId') classId: string, @Body() dto: Partial<CreateClassDto>) {
    return this.classesService.updateClass(classId, dto);
  }

  @Get('classes')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'FINANCE', 'HEAD_OF_DEPARTMENT', 'TEACHER')
  @ApiOperation({ summary: 'List classes by academic year/level/stream' })
  async listClasses(
    @Query('academicYearId') academicYearId?: string,
    @Query('level') level?: string,
    @Query('stream') stream?: string,
    @Query('educationStage') educationStage?: string,
  ) {
    return this.classesService.listClasses({
      academicYearId,
      level: level ? Number(level) : undefined,
      stream,
      educationStage,
    });
  }

  @Post('class-pathways')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create or update class promotion/transition pathway' })
  async createClassPathway(@Body() dto: CreateClassPathwayDto) {
    return this.classesService.createClassPathway(dto);
  }

  @Get('class-pathways')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT')
  @ApiOperation({ summary: 'List configured class transition pathways' })
  async listClassPathways(
    @Query('academicYearId') academicYearId?: string,
    @Query('transitionType') transitionType?: string,
  ) {
    return this.classesService.listClassPathways({ academicYearId, transitionType });
  }

  @Get('class-pathways/resolve')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT')
  @ApiOperation({ summary: 'Resolve next class from configured pathway' })
  async resolveNextClass(@Query('fromClassId') fromClassId: string, @Query('academicYearId') academicYearId: string) {
    return this.classesService.resolveNextClass(fromClassId, academicYearId);
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
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'FINANCE', 'HEAD_OF_DEPARTMENT', 'TEACHER', 'STUDENT', 'PARENT', 'GUARDIAN')
  @ApiOperation({ summary: 'List terms by academic year/current flag' })
  async listTerms(@Query('academicYearId') academicYearId?: string, @Query('isCurrent') isCurrent?: string) {
    return this.classesService.listTerms({
      academicYearId,
      isCurrent: isCurrent === undefined ? undefined : isCurrent === 'true',
    });
  }

  @Delete('classes/:id')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete class — blocked if any enrolments (active or historical) exist' })
  async deleteClass(@Param('id') id: string) {
    await this.classesService.deleteClass(id);
  }

  @Delete('academic-years/:id')
  @Roles('SYSTEM_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete academic year — blocked if it is current or has linked terms, classes, or enrolments' })
  async deleteAcademicYear(@Param('id') id: string) {
    await this.classesService.deleteAcademicYear(id);
  }

  @Delete('terms/:id')
  @Roles('SYSTEM_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete term — blocked if it is current or has linked enrolments or attendance records' })
  async deleteTerm(@Param('id') id: string) {
    await this.classesService.deleteTerm(id);
  }
}
