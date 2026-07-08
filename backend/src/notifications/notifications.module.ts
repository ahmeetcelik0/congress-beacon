import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { LoggingNotificationSender } from './logging-notification-sender';
import { NOTIFICATION_SENDER } from './notification-sender.interface';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationSchedulerService,
    { provide: NOTIFICATION_SENDER, useClass: LoggingNotificationSender },
  ],
  exports: [NotificationSchedulerService],
})
export class NotificationsModule {}
