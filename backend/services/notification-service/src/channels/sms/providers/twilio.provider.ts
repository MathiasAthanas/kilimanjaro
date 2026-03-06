import { Injectable } from '@nestjs/common';
import { Twilio } from 'twilio';
import { ISmsProvider, SmsSendResult } from './sms-provider.interface';

@Injectable()
export class TwilioProvider implements ISmsProvider {
  private client(): Twilio {
    return new Twilio(process.env.TWILIO_ACCOUNT_SID || '', process.env.TWILIO_AUTH_TOKEN || '');
  }

  async send(to: string[], message: string, senderId?: string): Promise<SmsSendResult[]> {
    const client = this.client();
    const from = senderId || process.env.TWILIO_PHONE_NUMBER || '';

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
