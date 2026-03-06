import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FinancialAuditAction } from '@prisma/client';
import { ROLES } from '../common/constants/roles';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';

@ApiTags('Finance - Audit Logs')
@Controller('finance/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  list(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: FinancialAuditAction,
    @Query('performedById') performedById?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.list({
      entityType,
      entityId,
      action,
      performedById,
      startDate,
      endDate,
      page,
      limit,
    });
  }
}
