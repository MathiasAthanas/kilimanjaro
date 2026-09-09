import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { ISmsProvider, SmsSendResult } from './sms-provider.interface';

@Injectable()
export class TwilioProvider implements ISmsProvider {
  constructor(private readonly config: ConfigService) {}

  private client(): Twilio {
    return new Twilio(
      this.config.get<string>('TWILIO_ACCOUNT_SID', ''),
      this.config.get<string>('TWILIO_AUTH_TOKEN', ''),
    );
  }

  async send(to: string[], message: string, senderId?: string): Promise<SmsSendResult[]> {
    const client = this.client();
    const from = senderId || this.config.get<string>('TWILIO_PHONE_NUMBER', '');

    const results: SmsSendResult[] = [];
    for (const phone of to) {
      try {
        const sent = await client.messages.create({ to: phone, from, body: message });
        results.push({ phone, success: true, messageId: sent.sid });
      } catch (error) {
        results.push({ phone, success: false, failureReason: (error as Error).message });
      }
    }

    return results;
  }
}
