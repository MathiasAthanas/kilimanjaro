import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Sends the roll-call alerts and summaries to the school leadership. It asks auth-service who the leaders of a school
 * are (Head of School, Principal and the group Manager) and hands the message to notification-service as an in-app
 * notification. Both calls are plain HTTP with the shared internal key, so nothing depends on the message queue.
 */
@Injectable()
export class RollCallNotifierService {
  private readonly logger = new Logger(RollCallNotifierService.name);
  private readonly authUrl: string;
  private readonly notificationUrl: string;
  private readonly key: string;

  constructor(config: ConfigService) {
    this.authUrl = (config.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001').replace(/\/$/, '');
    this.notificationUrl = (config.get<string>('NOTIFICATION_SERVICE_URL') || 'http://localhost:3005').replace(/\/$/, '');
    this.key = config.get<string>('INTERNAL_API_KEY') || '';
  }

  async leaders(schoolId: string): Promise<string[]> {
    try {
      const res = await fetch(`${this.authUrl}/api/v1/auth/internal/school-leaders?schoolId=${encodeURIComponent(schoolId)}`, {
        headers: { 'x-internal-api-key': this.key },
      });
      if (!res.ok) throw new Error(`auth-service answered ${res.status}`);
      const body = (await res.json()) as { data?: { userIds?: string[] }; userIds?: string[] };
      return body.data?.userIds ?? body.userIds ?? [];
    } catch (err) {
      this.logger.warn(`Could not look up the leaders of school ${schoolId}: ${(err as Error)?.message}`);
      return [];
    }
  }

  /** Returns how many people were notified (0 when nobody could be reached). */
  async notifyLeaders(schoolId: string, subject: string, body: string, key: string): Promise<number> {
    const recipientIds = await this.leaders(schoolId);
    if (!recipientIds.length) return 0;
    try {
      const res = await fetch(`${this.notificationUrl}/api/v1/notifications/internal/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-api-key': this.key },
        body: JSON.stringify({
          eventType: 'manual',
          sourceService: 'student-service',
          payload: { recipientIds, subject, body, channel: 'IN_APP', sourceEventId: key },
        }),
      });
      if (!res.ok) throw new Error(`notification-service answered ${res.status}`);
      return recipientIds.length;
    } catch (err) {
      this.logger.warn(`Could not send the roll-call notification for school ${schoolId}: ${(err as Error)?.message}`);
      return 0;
    }
  }
}
