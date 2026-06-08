import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateFundRequestDto } from './dto/create-fund-request.dto';
import {
  ApproveFundRequestDto,
  CancelFundRequestDto,
  DisburseFundRequestDto,
  ForwardFundRequestDto,
  RejectFundRequestDto,
} from './dto/workflow.dto';
import { FundRequestsService } from './fund-requests.service';

@ApiTags('Finance - Fund Requests')
@Controller('finance/fund-requests')
export class FundRequestsController {
  constructor(private readonly service: FundRequestsService) {}

  @Post()
  @Roles(ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.FINANCE, ROLES.SYSTEM_ADMIN)
  create(@Body() dto: CreateFundRequestDto, @CurrentUser() user?: RequestUser) {
    return this.service.create(dto, user!);
  }

  @Get()
  @Roles(
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.FINANCE,
    ROLES.PRINCIPAL,
    ROLES.SYSTEM_ADMIN,
    ROLES.MANAGING_DIRECTOR,
    ROLES.BOARD_DIRECTOR,
  )
  list(@Query() query: any, @CurrentUser() user?: RequestUser) {
    return this.service.list(user!, query);
  }

  @Get('summary')
  @Roles(
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.FINANCE,
    ROLES.PRINCIPAL,
    ROLES.SYSTEM_ADMIN,
    ROLES.MANAGING_DIRECTOR,
    ROLES.BOARD_DIRECTOR,
  )
  summary(@CurrentUser() user?: RequestUser) {
    return this.service.summary(user!);
  }

  @Get(':id')
  @Roles(
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.FINANCE,
    ROLES.PRINCIPAL,
    ROLES.SYSTEM_ADMIN,
    ROLES.MANAGING_DIRECTOR,
    ROLES.BOARD_DIRECTOR,
  )
  byId(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.service.byId(id, user!);
  }

  @Patch(':id/forward')
  @Roles(ROLES.FINANCE, ROLES.SYSTEM_ADMIN)
  forward(@Param('id') id: string, @Body() dto: ForwardFundRequestDto, @CurrentUser() user?: RequestUser) {
    return this.service.forward(id, dto, user!);
  }

  @Patch(':id/approve')
  @Roles(ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  approve(@Param('id') id: string, @Body() dto: ApproveFundRequestDto, @CurrentUser() user?: RequestUser) {
    return this.service.approve(id, dto, user!);
  }

  @Patch(':id/reject')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  reject(@Param('id') id: string, @Body() dto: RejectFundRequestDto, @CurrentUser() user?: RequestUser) {
    return this.service.reject(id, dto, user!);
  }

  @Patch(':id/disburse')
  @Roles(ROLES.FINANCE, ROLES.SYSTEM_ADMIN)
  disburse(@Param('id') id: string, @Body() dto: DisburseFundRequestDto, @CurrentUser() user?: RequestUser) {
    return this.service.disburse(id, dto, user!);
  }

  @Patch(':id/cancel')
  @Roles(ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.FINANCE, ROLES.SYSTEM_ADMIN)
  cancel(@Param('id') id: string, @Body() dto: CancelFundRequestDto, @CurrentUser() user?: RequestUser) {
    return this.service.cancel(id, dto, user!);
  }
}
