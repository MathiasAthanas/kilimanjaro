import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ApplyInvoicePlanDto, BulkApplyPlansDto, PreviewPlanDto, SavePaymentPlanDto, SetCustomPlanDto } from './payment-plans.dto';
import { PaymentPlansService } from './payment-plans.service';

const MANAGE = [ROLES.FINANCE, ROLES.HEAD_OF_FINANCE, ROLES.PRINCIPAL, ROLES.HEAD_OF_SCHOOL, ROLES.MANAGER, ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN] as const;

@ApiTags('Finance - Payment plans')
@Controller('finance')
export class PaymentPlansController {
  constructor(private readonly service: PaymentPlansService) {}

  @Get('payment-plans')
  @Roles(...MANAGE)
  list(@Query('includeInactive') includeInactive?: string, @CurrentUser() user?: RequestUser) {
    return this.service.list(user, includeInactive === 'true');
  }

  @Post('payment-plans')
  @Roles(...MANAGE)
  create(@Body() dto: SavePaymentPlanDto, @CurrentUser() user?: RequestUser) {
    return this.service.create(dto, user!);
  }

  @Post('payment-plans/preview')
  @Roles(...MANAGE)
  preview(@Body() dto: PreviewPlanDto) {
    return this.service.preview(dto);
  }

  @Post('payment-plans/apply-to-term')
  @Roles(...MANAGE)
  bulkApply(@Body() dto: BulkApplyPlansDto, @CurrentUser() user?: RequestUser) {
    return this.service.bulkApply(dto, user!);
  }

  @Put('payment-plans/:id')
  @Roles(...MANAGE)
  update(@Param('id') id: string, @Body() dto: SavePaymentPlanDto, @CurrentUser() user?: RequestUser) {
    return this.service.update(id, dto, user!);
  }

  @Patch('payment-plans/:id/active')
  @Roles(...MANAGE)
  setActive(@Param('id') id: string, @Body('isActive') isActive: boolean, @CurrentUser() user?: RequestUser) {
    return this.service.setActive(id, !!isActive, user!);
  }

  @Get('invoices/:id/plan')
  @Roles(...MANAGE)
  view(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.service.view(id, user);
  }

  @Post('invoices/:id/plan')
  @Roles(...MANAGE)
  apply(@Param('id') id: string, @Body() dto: ApplyInvoicePlanDto, @CurrentUser() user?: RequestUser) {
    return this.service.apply(id, dto, user!);
  }

  @Put('invoices/:id/plan')
  @Roles(...MANAGE)
  custom(@Param('id') id: string, @Body() dto: SetCustomPlanDto, @CurrentUser() user?: RequestUser) {
    return this.service.setCustom(id, dto, user!);
  }

  @Delete('invoices/:id/plan')
  @Roles(...MANAGE)
  clear(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.service.clear(id, user!);
  }
}
