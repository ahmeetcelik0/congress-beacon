import { Injectable, Logger } from '@nestjs/common';
import { MailSender } from './mail-sender.interface';

// SMTP bilgisi yoksa (yerel gelistirme/test) devreye giren varsayilan
// gonderici: gercekten e-posta atmaz, sadece loglar - ayni desen
// LoggingNotificationSender'da (bkz. notifications/). Gercek SMTP
// baglanacagi zaman bu sinifin yerine SmtpMailSender saglanir (bkz.
// mail.module.ts) - baska hicbir yerde kod degisikligi gerekmez.
@Injectable()
export class LoggingMailSender implements MailSender {
  private readonly logger = new Logger(LoggingMailSender.name);

  sendVerificationCode(to: string, code: string): Promise<void> {
    // Kod, sadece production DISINDA loglanir - sifir/dogrulama kodu
    // production log'larina asla yazilmamali.
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[DEV] Dogrulama kodu -> ${to}: ${code}`);
    } else {
      this.logger.log(
        `[DEV] Dogrulama kodu gonderilecekti -> ${to} (SMTP yapilandirilmamis)`,
      );
    }
    return Promise.resolve();
  }
}
