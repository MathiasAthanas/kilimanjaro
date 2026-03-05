import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetCompleteDto } from './dto/password-reset-complete.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LogoutDto } from './dto/logout.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { InternalApiGuard } from './guards/internal-api.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password or registrationNumber/password' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      ip: req.ip || '',
      userAgent: String(req.headers['user-agent'] || ''),
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, {
      ip: req.ip || '',
      userAgent: String(req.headers['user-agent'] || ''),
    });
  }

  @Public()
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto, @Req() req: Request) {
    await this.authService.requestPasswordReset(dto.email, {
      ip: req.ip || '',
      userAgent: String(req.headers['user-agent'] || ''),
    });

    return { message: 'If the account exists, a reset code has been sent' };
  }

  @Public()
  @Post('password-reset/complete')
  @HttpCode(HttpStatus.OK)
  async completePasswordReset(@Body() dto: PasswordResetCompleteDto, @Req() req: Request) {
    await this.authService.completePasswordReset(dto, {
      ip: req.ip || '',
      userAgent: String(req.headers['user-agent'] || ''),
    });

    return { message: 'Password reset completed successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: { sub: string; jti: string; exp?: number },
    @Body() body: LogoutDto,
  ) {
    await this.authService.logout(user, body.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  async me(@CurrentUser() user: { sub: string }) {
    return this.authService.me(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('change-password')
  async changePassword(
    @CurrentUser() user: { sub: string },
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    await this.authService.changePassword(user.sub, dto, {
      ip: req.ip || '',
      userAgent: String(req.headers['user-agent'] || ''),
    });
    return { message: 'Password changed successfully' };
  }

  @UseGuards(InternalApiGuard)
  @Get('internal/validate-jti/:jti')
  async validateJti(@Param('jti') jti: string) {
    const blacklisted = await this.authService.isJtiBlacklisted(jti);
    return { blacklisted };
  }

  @UseGuards(InternalApiGuard)
  @Get('internal/user/:userId')
  async getUserForGateway(@Param('userId') userId: string) {
    return this.authService.getUserForGateway(userId);
  }
}
