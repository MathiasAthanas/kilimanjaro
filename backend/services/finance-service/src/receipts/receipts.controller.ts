import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { VoidReceiptDto } from './dto/void-receipt.dto';
import { ReceiptsService } from './receipts.service';

@ApiTags('Finance - Receipts')
@Controller('finance/receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.PARENT, ROLES.STUDENT)
  list(@Query() query: any) {
    return this.receiptsService.list(query);
  }

  @Get(':id')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.PARENT, ROLES.STUDENT)
  byId(@Param('id') id: string) {
    return this.receiptsService.byId(id);
  }

  @Get(':id/pdf')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.PARENT, ROLES.STUDENT)
  pdf(@Param('id') id: string) {
    return this.receiptsService.byId(id);
  }

  @Patch(':id/void')
  @Roles(ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  void(@Param('id') id: string, @Body() dto: VoidReceiptDto, @CurrentUser() user?: RequestUser) {
    return this.receiptsService.void(id, dto.voidReason, user!);
  }
}
