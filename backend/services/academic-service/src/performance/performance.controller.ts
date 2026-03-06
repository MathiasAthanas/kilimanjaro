import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateInterventionDto } from './dto/create-intervention.dto';
import { PerformanceFilterDto } from './dto/performance-filter.dto';
import { RunEngineDto } from './dto/run-engine.dto';
import { UpdateInterventionDto } from './dto/update-intervention.dto';
import { InterventionsService } from './interventions.service';
import { PerformanceProxyService } from './performance-proxy.service';

@ApiTags('Academic - Performance')
@Controller('academics')
export class PerformanceController {
  constructor(
    private readonly performanceProxyService: PerformanceProxyService,
    private readonly interventionsService: InterventionsService,
  ) {}

  @Get('performance/alerts')
  @Roles(ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT, ROLES.SYSTEM_ADMIN, ROLES.TEACHER)
  alerts(@Query() query: PerformanceFilterDto, @CurrentUser() user?: RequestUser) {
    return this.performanceProxyService.alerts(query as unknown as Record<string, unknown>, user!);
  }

  @Get('performance/alerts/class/:classId')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  alertsByClass(@Param('classId') classId: string, @CurrentUser() user?: RequestUser) {
    return this.performanceProxyService.alertsByClass(classId, user!);
  }

  @Patch('performance/alerts/:alertId/resolve')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  resolve(
    @Param('alertId') alertId: string,
    @Body() body: { resolutionNote: string },
    @CurrentUser() user?: RequestUser,
  ) {
    return this.performanceProxyService.resolveAlert(alertId, body, user!);
  }

  @Patch('performance/alerts/:alertId/escalate')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT)
  escalate(
    @Param('alertId') alertId: string,
    @Body() body: { studentId: string; subjectName?: string; note: string },
    @CurrentUser() user?: RequestUser,
  ) {
    return this.performanceProxyService.escalateAlert(alertId, body, user!);
  }

  @Get('performance/pairings')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  pairings(@Query() query: Record<string, unknown>, @CurrentUser() user?: RequestUser) {
    return this.performanceProxyService.pairings(query, user!);
  }

  @Patch('performance/pairings/:pairingId/activate')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL)
  activatePairing(@Param('pairingId') pairingId: string, @CurrentUser() user?: RequestUser) {
    return this.performanceProxyService.activatePairing(pairingId, user!);
  }

  @Patch('performance/pairings/:pairingId/reject')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL)
  rejectPairing(
    @Param('pairingId') pairingId: string,
    @Body() body: { reason: string },
    @CurrentUser() user?: RequestUser,
  ) {
    return this.performanceProxyService.rejectPairing(pairingId, body.reason, user!);
  }

  @Post('performance/pairings')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL)
  createPairing(@Body() body: Record<string, unknown>, @CurrentUser() user?: RequestUser) {
    return this.performanceProxyService.createPairing(body, user!);
  }

  @Get('performance/pairings/effectiveness')
  @Roles(ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.SYSTEM_ADMIN)
  pairingsEffectiveness(@CurrentUser() user?: RequestUser) {
    return this.performanceProxyService.pairingsEffectiveness(user!);
  }

  @Get('performance/student/:studentId')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.STUDENT,
  )
  studentProfile(@Param('studentId') studentId: string, @CurrentUser() user?: RequestUser) {
    return this.performanceProxyService.studentProfile(studentId, user!);
  }

  @Get('performance/class/:classId/summary')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  classSummary(@Param('classId') classId: string, @CurrentUser() user?: RequestUser) {
    return this.performanceProxyService.classSummary(classId, user!);
  }

  @Get('performance/school/summary')
  @Roles(ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.MANAGING_DIRECTOR, ROLES.SYSTEM_ADMIN)
  schoolSummary(@CurrentUser() user?: RequestUser) {
    return this.performanceProxyService.schoolSummary(user!);
  }

  @Post('performance/engine/run')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  runEngine(@Body() body: RunEngineDto, @CurrentUser() user?: RequestUser) {
    return this.performanceProxyService.runEngine(body, user!);
  }

  @Get('performance/engine/config')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  engineConfig(@CurrentUser() user?: RequestUser) {
    return this.performanceProxyService.getEngineConfig(user!);
  }

  @Patch('performance/engine/config')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL)
  updateEngineConfig(@Body() body: Record<string, unknown>, @CurrentUser() user?: RequestUser) {
    return this.performanceProxyService.updateEngineConfig(body, user!);
  }

  @Get('interventions')
  @Roles(ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT, ROLES.SYSTEM_ADMIN)
  interventions(
    @Query('studentId') studentId?: string,
    @Query('type') type?: string,
    @Query('performedById') performedById?: string,
    @Query('isFollowedUp') isFollowedUp?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.interventionsService.list({ studentId, type, performedById, isFollowedUp, subjectId });
  }

  @Post('interventions')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  createIntervention(@Body() dto: CreateInterventionDto, @CurrentUser() user?: RequestUser) {
    return this.interventionsService.create(dto, user!);
  }

  @Patch('interventions/:id')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  updateIntervention(@Param('id') id: string, @Body() dto: UpdateInterventionDto) {
    return this.interventionsService.update(id, dto);
  }

  @Get('interventions/student/:studentId')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
    ROLES.PARENT,
  )
  interventionsByStudent(@Param('studentId') studentId: string, @CurrentUser() user?: RequestUser) {
    return this.interventionsService.byStudent(studentId, user);
  }
}
