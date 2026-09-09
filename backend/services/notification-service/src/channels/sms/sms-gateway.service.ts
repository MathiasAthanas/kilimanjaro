import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeTzPhone } from '../../common/helpers/phone-normalizer.helper';
import { AfricasTalkingProvider } from './providers/africas-talking.provider';
import { BeemProvider } from './providers/beem.provider';
import { GenericHttpProvider } from './providers/generic-http.provider';
import { SmsSendResult } from './providers/sms-provider.interface';
import { TwilioProvider } from './providers/twilio.provider';

@Injectable()
export class SmsGatewayService {
  private readonly logger = new Logger(SmsGatewayService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly at: AfricasTalkingProvider,
    private readonly beem: BeemProvider,
    private readonly twilio: TwilioProvider,
    private readonly generic: GenericHttpProvider,
  ) {}

  private provider() {
    const name = (this.config.get<string>('SMS_PROVIDER', 'africastalking') || '').toLowerCase();
    switch (name) {
      case 'beem':
        return this.beem;
      case 'twilio':
        return this.twilio;
      case 'generic':
        return this.generic;
      case 'mock':
        this.logger.warn('SMS_PROVIDER=mock — all SMS sends are no-ops. Set a real provider for production.');
        return null;
      default:
        return this.at;
    }
  }

  async send(to: string[], message: string, senderId?: string): Promise<SmsSendResult[]> {
    const normalized = to.map((p) => normalizeTzPhone(p)).filter((x): x is string => Boolean(x));
    if (!normalized.length) {
      return [];
    }

    if (message.length > 160) {
      this.logger.warn('SMS body exceeds 160 chars; provider may split into multiple segments');
    }

    const provider = this.provider();
    if (!provider) return normalized.map((phone) => ({ phone, success: true, messageId: 'mock' }));
    const batches: string[][] = [];
    for (let i = 0; i < normalized.length; i += 50) batches.push(normalized.slice(i, i + 50));

    const results: SmsSendResult[] = [];
    for (const batch of batches) {
      let attempts = 0;
      let sent: SmsSendResult[] = [];
      while (attempts < 3) {
        attempts += 1;
        sent = await provider.send(batch, message, senderId || this.config.get<string>('SMS_SENDER_ID'));
        if (sent.every((x) => x.success)) break;
        await new Promise((resolve) => setTimeout(resolve, attempts === 1 ? 1000 : attempts === 2 ? 3000 : 9000));
      }
      results.push(...sent);
    }

    return results;
  }
}
