import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { MailSender } from './mail-sender.interface';
import { buildVerificationCodeEmail } from './verification-code-email';

@Injectable()
export class SmtpMailSender implements MailSender {
  private readonly transporter: Transporter;
  private readonly from: string;
  // Faz 10 §7c: kullanicinin dogrudan yanitlayabilecegi gercek bir destek
  // adresi - MAIL_REPLY_TO tanimli DEGILSE gonderen adrese (MAIL_FROM,
  // genelde bir no-reply kutusu) DUSER, bu yuzden production'da MUTLAKA
  // ayarlanmali (bkz. docs/decisions.md "Faz 10").
  private readonly replyTo: string;

  constructor(config: ConfigService) {
    this.transporter = createTransport({
      host: config.get<string>('SMTP_HOST'),
      port: Number(config.get<string>('SMTP_PORT') ?? 587),
      auth: {
        user: config.get<string>('SMTP_USER'),
        pass: config.get<string>('SMTP_PASS'),
      },
    });
    this.from =
      config.get<string>('MAIL_FROM') ?? 'no-reply@congress-beacon.local';
    this.replyTo = config.get<string>('MAIL_REPLY_TO') ?? this.from;
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    const { subject, text, html } = buildVerificationCodeEmail(code);
    await this.transporter.sendMail({
      from: this.from,
      to,
      replyTo: this.replyTo,
      subject,
      text,
      html,
    });
  }
}
