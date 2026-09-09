import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdmissionsService } from './admissions.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { UpdateApplicantDto } from './dto/update-applicant.dto';
import { ListApplicantsDto } from './dto/list-applicants.dto';
import { TransitionStageDto } from './dto/transition-stage.dto';
import { RecordAssessmentDto, ScheduleAssessmentDto } from './dto/assessment.dto';
import { IssueOfferDto, OfferDecisionDto } from './dto/offer.dto';
import { ConvertApplicantDto } from './dto/convert-applicant.dto';

const ADMISSIONS_WRITE = ['ADMISSIONS', 'SYSTEM_ADMIN'] as const;
const ADMISSIONS_READ = ['ADMISSIONS', 'SYSTEM_ADMIN', 'PRINCIPAL', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN'] as const;

@ApiTags('Admissions')
@Controller('admissions')
@UseGuards(RolesGuard)
@ApiBearerAuth()
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Post('applicants')
  @Roles(...ADMISSIONS_WRITE)
  @ApiOperation({ summary: 'Capture a new admission inquiry / application' })
  async create(@Body() dto: CreateApplicantDto, @CurrentUser() user?: RequestUser) {
    return this.admissionsService.create(dto, user?.id || 'system');
  }

  @Get('applicants')
  @Roles(...ADMISSIONS_READ)
  @ApiOperation({ summary: 'Paginated applicant list with stage/source filters' })
  async list(@Query() query: ListApplicantsDto, @CurrentUser() user?: RequestUser) {
    return this.admissionsService.list(query, user);
  }

  @Get('analytics')
  @Roles(...ADMISSIONS_READ)
  @ApiOperation({ summary: 'Admissions funnel, conversion, sources and seat capacity' })
  async analytics(@CurrentUser() user?: RequestUser) {
    return this.admissionsService.analytics(user);
  }

  @Get('applicants/:id')
  @Roles(...ADMISSIONS_READ)
  @ApiOperation({ summary: 'Full applicant profile with stage timeline, assessments and offer' })
  async byId(@Param('id') id: string) {
    return this.admissionsService.findById(id);
  }

  @Patch('applicants/:id')
  @Roles(...ADMISSIONS_WRITE)
  @ApiOperation({ summary: 'Update applicant details' })
  async update(@Param('id') id: string, @Body() dto: UpdateApplicantDto) {
    return this.admissionsService.update(id, dto);
  }

  @Post('applicants/:id/transition')
  @Roles(...ADMISSIONS_WRITE)
  @ApiOperation({ summary: 'Move an applicant to another pipeline stage (audited)' })
  async transition(
    @Param('id') id: string,
    @Body() dto: TransitionStageDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.admissionsService.transition(id, dto, user?.id || 'system');
  }

  @Post('applicants/:id/assessments')
  @Roles(...ADMISSIONS_WRITE)
  @ApiOperation({ summary: 'Schedule an entrance assessment / interview' })
  async scheduleAssessment(
    @Param('id') id: string,
    @Body() dto: ScheduleAssessmentDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.admissionsService.scheduleAssessment(id, dto, user?.id || 'system');
  }

  @Patch('assessments/:assessmentId')
  @Roles(...ADMISSIONS_WRITE)
  @ApiOperation({ summary: 'Record an assessment score / outcome' })
  async recordAssessment(
    @Param('assessmentId') assessmentId: string,
    @Body() dto: RecordAssessmentDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.admissionsService.recordAssessment(assessmentId, dto, user?.id || 'system');
  }

  @Post('applicants/:id/offer')
  @Roles(...ADMISSIONS_WRITE)
  @ApiOperation({ summary: 'Issue (or re-issue) an admission offer' })
  async issueOffer(
    @Param('id') id: string,
    @Body() dto: IssueOfferDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.admissionsService.issueOffer(id, dto, user?.id || 'system');
  }

  @Post('applicants/:id/offer/decision')
  @Roles(...ADMISSIONS_WRITE)
  @ApiOperation({ summary: 'Record the guardian decision on an offer' })
  async decideOffer(
    @Param('id') id: string,
    @Body() dto: OfferDecisionDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.admissionsService.decideOffer(id, dto, user?.id || 'system');
  }

  @Post('applicants/:id/convert')
  @Roles(...ADMISSIONS_WRITE)
  @ApiOperation({ summary: 'Convert an accepted applicant into an enrolled student' })
  async convert(
    @Param('id') id: string,
    @Body() dto: ConvertApplicantDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.admissionsService.convert(id, dto, user?.id || 'system');
  }
}
