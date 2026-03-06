import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseService } from '../../firebase/firebase.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  async send(userId: string, title: string, body: string, data?: Record<string, string>) {
    const tokens = await this.prisma.deviceToken.findMany({ where: { userId, isActive: true } });
    if (!tokens.length) return { sent: 0, failed: 0 };

    const app = this.firebase.app();
    if (!app) return { sent: 0, failed: tokens.length };

    const messaging = app.messaging();
    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((x) => x.token),
      notification: { title, body },
      data,
    });

    const toDeactivate: string[] = [];
    response.responses.forEach((r, i) => {
      const code = (r.error as any)?.code;
      if (!r.success && (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument')) {
        toDeactivate.push(tokens[i].token);
      }
    });

    if (toDeactivate.length) {
      await this.prisma.deviceToken.updateMany({ where: { token: { in: toDeactivate } }, data: { isActive: false } });
      this.logger.warn(`Deactivated ${toDeactivate.length} invalid FCM tokens`);
    }

    return { sent: response.successCount, failed: response.failureCount };
  }
}
