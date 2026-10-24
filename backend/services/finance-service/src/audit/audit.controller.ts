import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FinancialAuditAction } from '../../generated/prisma';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';

@ApiTags('Finance - Audit Logs')
@Controller('finance/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR, ROLES.FINANCE, ROLES.HEAD_OF_FINANCE)
  list(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: FinancialAuditAction,
    @Query('performedById') performedById?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.auditService.list(user, {
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
