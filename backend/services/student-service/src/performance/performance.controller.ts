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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PerformanceService } from './performance.service';
import { PerformanceEngineService } from './performance-engine.service';
import { ResolveAlertDto } from './dto/resolve-alert.dto';
import { PerformanceFilterDto } from './dto/performance-filter.dto';
import { UpdatePairingStatusDto } from './dto/update-pairing-status.dto';
import { CreatePairingDto } from './dto/create-pairing.dto';
import { RunEngineDto } from './dto/run-engine.dto';
import { UpdateEngineConfigDto } from './dto/update-engine-config.dto';

@ApiTags('Performance')
@Controller('students/performance')
@UseGuards(RolesGuard)
@ApiBearerAuth()
export class PerformanceController {
  constructor(
    private readonly performanceService: PerformanceService,
    private readonly engine: PerformanceEngineService,
  ) {}

  @Get('alerts')
  @Roles('PRINCIPAL', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Paginated active alerts with role-aware filtering' })
  @ApiResponse({ status: 200, description: 'Alert list returned' })
  async alerts(@Query() query: PerformanceFilterDto, @CurrentUser() user?: RequestUser) {
    return this.performanceService.alerts(query, user || { id: 'system', role: 'SYSTEM_ADMIN' });
  }

  @Get('alerts/class/:classId')
  @Roles('TEACHER', 'HEAD_OF_DEPARTMENT', 'PRINCIPAL', 'ACADEMIC_QA')
  @ApiOperation({ summary: 'Class alerts grouped by subject' })
  async alertsByClass(@Param('classId') classId: string, @CurrentUser() user?: RequestUser) {
    return this.performanceService.alertsByClass(classId, user || { id: 'system', role: 'SYSTEM_ADMIN' });
  }

  @Patch('alerts/:alertId/resolve')
  @Roles('TEACHER', 'HEAD_OF_DEPARTMENT', 'PRINCIPAL', 'ACADEMIC_QA')
  @ApiOperation({ summary: 'Manually resolve alert' })
  async resolveAlert(
    @Param('alertId') alertId: string,
    @Body() dto: ResolveAlertDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.performanceService.resolveAlert(
      alertId,
      dto.resolutionNote,
      user?.id || 'system',
      user?.role,
    );
  }

  @Get('pairings')
  @Roles('TEACHER', 'HEAD_OF_DEPARTMENT', 'PRINCIPAL', 'ACADEMIC_QA', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'List peer pairings with filters' })
  async pairings(@Query() query: PerformanceFilterDto) {
    return this.performanceService.listPairings(query);
  }

  @Patch('pairings/:pairingId/status')
  @Roles('TEACHER', 'HEAD_OF_DEPARTMENT', 'PRINCIPAL')
  @ApiOperation({ summary: 'Update pairing lifecycle status' })
  async updatePairingStatus(@Param('pairingId') pairingId: string, @Body() dto: UpdatePairingStatusDto) {
    return this.performanceService.updatePairingStatus(pairingId, dto);
  }

  @Post('pairings')
  @Roles('TEACHER', 'HEAD_OF_DEPARTMENT', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create manual peer pairing recommendation' })
  async createPairing(@Body() dto: CreatePairingDto, @CurrentUser() user?: RequestUser) {
    return this.performanceService.manualPairing(dto, user?.role || 'TEACHER');
  }

  @Post('engine/run')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA')
  @ApiOperation({ summary: 'Trigger asynchronous performance engine run' })
  async runEngine(@Body() dto: RunEngineDto) {
    const estimatedRecords = await this.engine.runScopeAsync(dto.scope, dto.studentId, dto.classId);
    return {
      triggered: true,
      scope: dto.scope,
      estimatedRecords,
    };
  }

  @Get('engine/config')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA')
  @ApiOperation({ summary: 'Read current engine thresholds and toggles' })
  async config() {
    return this.engine.getEngineConfig();
  }

  @Patch('engine/config')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Update engine thresholds and invalidate cached summaries' })
  async updateConfig(@Body() dto: UpdateEngineConfigDto, @CurrentUser() user?: RequestUser) {
    return this.engine.updateEngineConfig(dto as unknown as Record<string, unknown>, user?.id || 'system');
  }

  @Get('summary/class/:classId')
  @Roles('TEACHER', 'HEAD_OF_DEPARTMENT', 'PRINCIPAL', 'ACADEMIC_QA')
  @ApiOperation({ summary: 'Class-level performance summary by subject' })
  async classSummary(@Param('classId') classId: string) {
    return this.performanceService.classSummary(classId);
  }

  @Get('summary/school')
  @Roles('PRINCIPAL', 'ACADEMIC_QA', 'MANAGING_DIRECTOR', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'School-wide risk and effectiveness summary' })
  async schoolSummary() {
    return this.performanceService.schoolSummary();
  }

  @Get('pairings/effectiveness')
  @Roles('PRINCIPAL', 'ACADEMIC_QA', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Pairing outcome effectiveness analytics' })
  async effectiveness() {
    return this.performanceService.pairingEffectiveness();
  }

  @Get(':studentId/subject/:subjectId')
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
  @ApiOperation({ summary: 'Subject-level deep dive for one student' })
  async subject(@Param('studentId') studentId: string, @Param('subjectId') subjectId: string, @CurrentUser() user?: RequestUser) {
    return this.performanceService.subjectDeepDive(studentId, subjectId, user);
  }

  @Get(':studentId')
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
  @ApiOperation({ summary: 'Full performance profile with trends, active alerts and pairings' })
  async profile(@Param('studentId') studentId: string, @CurrentUser() user?: RequestUser) {
    return this.performanceService.profile(studentId, user);
  }
}
