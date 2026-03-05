import {
  All,
  Controller,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Proxy')
@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All(['auth/login', 'api/v1/auth/login'])
  @Public()
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'Public login route proxy' })
  async loginProxy(@Req() req: Request, @Res() res: Response) {
    return this.forwardPublic(req, res);
  }

  @All(['auth/refresh', 'api/v1/auth/refresh'])
  @Public()
  async refreshProxy(@Req() req: Request, @Res() res: Response) {
    return this.forwardPublic(req, res);
  }

  @All(['auth/password-reset/request', 'api/v1/auth/password-reset/request'])
  @Public()
  async resetRequestProxy(@Req() req: Request, @Res() res: Response) {
    return this.forwardPublic(req, res);
  }

  @All(['auth/password-reset/complete', 'api/v1/auth/password-reset/complete'])
  @Public()
  async resetCompleteProxy(@Req() req: Request, @Res() res: Response) {
    return this.forwardPublic(req, res);
  }

  @All('*')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Catch-all protected proxy route' })
  @ApiResponse({ status: 200, description: 'Response proxied from downstream service' })
  async proxyProtected(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser() user: { id: string; role: string; email?: string | null },
  ) {
    const route = this.proxyService.resolveRoute(req.path);
    const result = await this.proxyService.forward(req, route, user);
    return res.status(result.statusCode).json(result.data);
  }

  private async forwardPublic(req: Request, res: Response) {
    const route = this.proxyService.resolveRoute(req.path);
    const result = await this.proxyService.forward(req, route);
    return res.status(result.statusCode).json(result.data);
  }
}
