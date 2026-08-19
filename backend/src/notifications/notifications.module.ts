import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsController } from './notifications.controller';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { LoggingNotificationSender } from './logging-notification-sender';
import { FcmNotificationSender } from './fcm-notification-sender';
import {
  NOTIFICATION_SENDER,
  NotificationSender,
} from './notification-sender.interface';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationSchedulerService,
    LoggingNotificationSender,
    {
      provide: NOTIFICATION_SENDER,
      inject: [ConfigService, PrismaService, LoggingNotificationSender],
      // FIREBASE_SERVICE_ACCOUNT_JSON tanimliysa gercek FCM gonderimi,
      // degilse log'a yazan gelistirme saglayicisi - ayni "MailModule"
      // (SMTP_HOST) desenindeki secim mantigi. `FcmNotificationSender`
      // BILEREK `providers` listesine EKLENMEDI: Nest onu orada gorse
      // yapilandirma OLMASA BILE constructor'ini (JSON.parse) hemen
      // calistirirdi ve uygulama ACILISTA COKERDI - bu yuzden burada
      // ELLE, try/catch icinde kuruluyor (bkz. Faz 9 talimati "yapilandirma
      // yoksa zarif dus").
      useFactory: (
        config: ConfigService,
        prisma: PrismaService,
        logging: LoggingNotificationSender,
      ): NotificationSender => {
        const serviceAccountJson = config.get<string>(
          'FIREBASE_SERVICE_ACCOUNT_JSON',
        );
        if (!serviceAccountJson) return logging;
        try {
          return new FcmNotificationSender(serviceAccountJson, prisma);
        } catch (error) {
          new Logger('NotificationsModule').error(
            `FIREBASE_SERVICE_ACCOUNT_JSON gecersiz - LoggingNotificationSender'a dusuluyor: ${error}`,
          );
          return logging;
        }
      },
    },
  ],
  exports: [NotificationSchedulerService],
})
export class NotificationsModule {}
