import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { DispatchService } from '../dispatch/dispatch.service';
import { NotificationsService } from '../notifications/notifications.service';

@ApiTags('Notifications - Internal')
@Controller('notifications/internal')
@UseGuards(InternalApiGuard)
export class InternalController {
  constructor(
    private readonly dispatch: DispatchService,
    private readonly notifications: NotificationsService,
  ) {}

  @Post('dispatch')
  dispatchNow(@Body() body: { eventType: string; payload: any; sourceService: string }) {
    return this.dispatch.dispatchFromEvent(body.eventType, body.payload, body.sourceService);
  }

  @Get('unread/:userId')
  unread(@Param('userId') userId: string) {
    return this.notifications.unreadCount(userId).then((count) => ({ count }));
  }
}
