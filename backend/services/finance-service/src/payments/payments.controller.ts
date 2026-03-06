import { Body, Controller, Get, Headers, Patch, Post, Query, Param, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { RejectApprovalDto } from './dto/reject-approval.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Finance - Payments')
@Controller('finance/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook/mobile-money')
  @Public()
  async mobileWebhook(@Req() req: any, @Headers('x-webhook-signature') signature: string, @Body() payload: any) {
    return this.paymentsService.mobileWebhook({
      bodyRaw: req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(payload),
      signature,
      payload,
    });
  }

  @Post('bank-transfer')
  @Roles(ROLES.FINANCE, ROLES.SYSTEM_ADMIN)
  bankTransfer(@Body() dto: CreateManualPaymentDto, @CurrentUser() user?: RequestUser) {
    return this.paymentsService.bankTransfer(dto, user!);
  }

  @Post('cash')
  @Roles(ROLES.FINANCE, ROLES.SYSTEM_ADMIN)
  cash(@Body() dto: CreateManualPaymentDto, @CurrentUser() user?: RequestUser) {
    return this.paymentsService.cash(dto, user!);
  }

  @Get()
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  list(@Query() query: any, @CurrentUser() user?: RequestUser) {
    return this.paymentsService.list(query, user!);
  }

  @Get('pending-approval')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  pending(@CurrentUser() user?: RequestUser) {
    return this.paymentsService.pendingApprovals(user!);
  }

  @Patch('approvals/:approvalId/approve')
  @Roles(ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  approve(@Param('approvalId') approvalId: string, @CurrentUser() user?: RequestUser) {
    return this.paymentsService.approve(approvalId, user!);
  }

  @Patch('approvals/:approvalId/reject')
  @Roles(ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  reject(@Param('approvalId') approvalId: string, @Body() dto: RejectApprovalDto, @CurrentUser() user?: RequestUser) {
    return this.paymentsService.reject(approvalId, dto.rejectionReason, user!);
  }

  @Patch(':id/refund')
  @Roles(ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  refund(@Param('id') id: string, @Body() dto: RefundPaymentDto, @CurrentUser() user?: RequestUser) {
    return this.paymentsService.refund(id, dto.refundReason, user!);
  }
}
