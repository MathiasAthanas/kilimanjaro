import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreatePaymentAccountDto, UpdateFinanceSettingsDto, UpdatePaymentAccountDto, UploadBrandingImageDto } from './finance-settings.dto';
import { BrandingKind, FinanceSettingsService } from './finance-settings.service';

/** Finance, the heads of finance and school, the manager and the administrators can change payment info and invoice branding. */
const MANAGE = [ROLES.FINANCE, ROLES.HEAD_OF_FINANCE, ROLES.HEAD_OF_SCHOOL, ROLES.MANAGER, ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN] as const;

@ApiTags('Finance - Payment info and branding')
@Controller('finance')
export class FinanceSettingsController {
  constructor(private readonly service: FinanceSettingsService) {}

  @Get('payment-accounts')
  @Roles(...MANAGE)
  accounts(@Query('includeInactive') includeInactive?: string, @CurrentUser() user?: RequestUser) {
    return this.service.listAccounts(user, includeInactive === 'true');
  }

  @Post('payment-accounts')
  @Roles(...MANAGE)
  createAccount(@Body() dto: CreatePaymentAccountDto, @CurrentUser() user?: RequestUser) {
    return this.service.createAccount(dto, user!);
  }

  @Patch('payment-accounts/:id')
  @Roles(...MANAGE)
  updateAccount(@Param('id') id: string, @Body() dto: UpdatePaymentAccountDto, @CurrentUser() user?: RequestUser) {
    return this.service.updateAccount(id, dto, user!);
  }

  @Delete('payment-accounts/:id')
  @Roles(...MANAGE)
  removeAccount(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.service.removeAccount(id, user!);
  }

  @Get('settings')
  @Roles(...MANAGE)
  settings(@CurrentUser() user?: RequestUser) {
    return this.service.getSettings(user);
  }

  @Patch('settings')
  @Roles(...MANAGE)
  updateSettings(@Body() dto: UpdateFinanceSettingsDto, @CurrentUser() user?: RequestUser) {
    return this.service.updateSettings(dto, user!);
  }

  /** Read by whoever changes a student's residence, so the screen can suggest "this term" or "next term". */
  @Get('settings/residence-policy')
  @Roles(...MANAGE, 'ADMISSIONS')
  residencePolicy(@CurrentUser() user?: RequestUser) {
    return this.service.residencePolicy(user);
  }

  @Put('settings/branding/:kind')
  @Roles(...MANAGE)
  saveImage(@Param('kind') kind: BrandingKind, @Body() dto: UploadBrandingImageDto, @CurrentUser() user?: RequestUser) {
    return this.service.saveImage(kind, dto.dataUrl, user!);
  }

  @Delete('settings/branding/:kind')
  @Roles(...MANAGE)
  removeImage(@Param('kind') kind: BrandingKind, @CurrentUser() user?: RequestUser) {
    return this.service.removeImage(kind, user!);
  }
}
