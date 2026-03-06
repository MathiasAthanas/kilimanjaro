import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ISmsProvider, SmsSendResult } from './sms-provider.interface';

@Injectable()
export class AfricasTalkingProvider implements ISmsProvider {
  async send(to: string[], message: string, senderId?: string): Promise<SmsSendResult[]> {
    try {
      const response = await axios.post(
        'https://api.africastalking.com/version1/messaging',
        new URLSearchParams({
          username: process.env.AT_USERNAME || 'sandbox',
          to: to.join(','),
          message,
          from: senderId || process.env.SMS_SENDER_ID || 'KILIMANJARO',
        }).toString(),
        {
          headers: {
            apiKey: process.env.AT_API_KEY || '',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        },
      );

      const recipients = response.data?.SMSMessageData?.Recipients || [];
      return recipients.map((r: any) => ({
        phone: r.number,
        success: String(r.status || '').toLowerCase().includes('success'),
        messageId: r.messageId,
        cost: r.cost,
        failureReason: String(r.status || '').toLowerCase().includes('success') ? undefined : r.status,
      }));
    } catch (error) {
      return to.map((phone) => ({ phone, success: false, failureReason: (error as Error).message }));
    }
  }
}
