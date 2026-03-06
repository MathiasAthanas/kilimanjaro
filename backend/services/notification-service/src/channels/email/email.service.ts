import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  constructor(private readonly config: ConfigService) {}

  private transport() {
    return nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'localhost'),
      port: Number(this.config.get<string>('SMTP_PORT', '1025')),
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: this.config.get<string>('SMTP_USER')
        ? {
            user: this.config.get<string>('SMTP_USER'),
            pass: this.config.get<string>('SMTP_PASS'),
          }
        : undefined,
    });
  }

  private wrapHtml(content: string): string {
    return `<div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:24px;"><div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;"><div style="background:#1E3A5F;color:#fff;padding:16px 20px;font-weight:700;">Kilimanjaro Schools</div><div style="padding:20px;color:#1f2937;">${content}</div><div style="padding:12px 20px;background:#f8fafc;color:#64748b;font-size:12px;">This is an automated message.</div></div></div>`;
  }

  async send(to: string, subject: string, htmlBody: string, textBody: string): Promise<string | null> {
    const transporter = this.transport();
    const result = await transporter.sendMail({
      from: this.config.get<string>('EMAIL_FROM_ADDRESS', 'Kilimanjaro Schools <no-reply@kilimanjaro.ac.tz>'),
      to,
      subject,
      html: this.wrapHtml(htmlBody),
      text: textBody,
    });

    return result.messageId || null;
  }
}
