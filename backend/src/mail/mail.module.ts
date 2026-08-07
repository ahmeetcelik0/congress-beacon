import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MAIL_SENDER } from './mail-sender.interface';
import { LoggingMailSender } from './logging-mail-sender';
import { SmtpMailSender } from './smtp-mail-sender';

@Module({
  imports: [ConfigModule],
  providers: [
    LoggingMailSender,
    SmtpMailSender,
    {
      provide: MAIL_SENDER,
      inject: [ConfigService, LoggingMailSender, SmtpMailSender],
      // SMTP_HOST tanimliysa gercek gonderim, degilse log'a yazan gelistirme
      // saglayicisi - ayni "NotificationSender" desenindeki secim mantigi.
      useFactory: (
        config: ConfigService,
        logging: LoggingMailSender,
        smtp: SmtpMailSender,
      ) => (config.get<string>('SMTP_HOST') ? smtp : logging),
    },
  ],
  exports: [MAIL_SENDER],
})
export class MailModule {}
