import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationPayload,
  NotificationSender,
} from './notification-sender.interface';

// Firebase/APNs kimlik bilgisi henuz yokken varsayilan saglayici: gonderimi
// gercekten yapmaz, sadece loglar. Gercek FCM baglanacagi zaman bu sinifin
// yerine NotificationModule'de FcmNotificationSender saglanir - baska hicbir
// yerde kod degisikligi gerekmez (NotificationSender arayuzu ayni kalir).
@Injectable()
export class LoggingNotificationSender implements NotificationSender {
  private readonly logger = new Logger(LoggingNotificationSender.name);

  send(payload: NotificationPayload): Promise<boolean> {
    this.logger.log(
      `[DEV] Bildirim gonderilecekti -> token=${payload.pushToken.slice(0, 12)}... baslik="${payload.title}" govde="${payload.body}" data=${JSON.stringify(payload.data ?? {})}`,
    );
    return Promise.resolve(true);
  }
}
