import { Injectable, Logger } from '@nestjs/common';
import {
  cert,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotificationPayload,
  NotificationSender,
} from './notification-sender.interface';

// FCM'in kalici hata kodlari - bu kodlarda token'i TEKRAR denemenin anlami
// yok, cihaz silinmis/uygulama kaldirilmis demektir (bkz. Firebase Admin SDK
// dokumantasyonu). Diger tum hatalar (ag, gecici sunucu hatasi vb.) GECICI
// sayilir - token SILINMEZ, bir sonraki gonderimde tekrar denenir.
const PERMANENT_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

// Faz 9: gercek FCM gonderimi. `NotificationSender` arayuzu DEGISMEDI -
// `LoggingNotificationSender` ile BIREBIR ayni sozlesmeyi uygular, secim
// `NotificationsModule`da yapilandirmaya (FIREBASE_SERVICE_ACCOUNT_JSON)
// gore yapilir (bkz. MailModule'daki SMTP_HOST deseni).
@Injectable()
export class FcmNotificationSender implements NotificationSender {
  private readonly logger = new Logger(FcmNotificationSender.name);
  private readonly app: App;

  constructor(
    serviceAccountJson: string,
    private readonly prisma: PrismaService,
  ) {
    const credentials = JSON.parse(serviceAccountJson) as ServiceAccount;
    // Ayni isimle birden fazla `initializeApp` cagrisi (ör. testte / hot
    // reload'da) hata firlatir - bu servis TEK bir NotificationsModule
    // saglayicisi olarak kuruldugu icin normalde bir kez calisir, ama
    // savunma amacli benzersiz bir app adi kullanilir.
    this.app = initializeApp(
      { credential: cert(credentials) },
      'notifications',
    );
  }

  async send(payload: NotificationPayload): Promise<boolean> {
    try {
      await getMessaging(this.app).send({
        token: payload.pushToken,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });
      return true;
    } catch (error) {
      const code = this.errorCode(error);
      if (code && PERMANENT_TOKEN_ERROR_CODES.has(code)) {
        // Cihaz silinmis/token gecersiz - bir daha SONSUZA KADAR denenmesin.
        // `updateMany` (`update` DEGIL): token'i kayitli TEK bir Device
        // satirina VARSAYMAK yerine, hangi satir(lar)da bu token varsa hepsi
        // temizlenir (teorik olarak ayni token iki Device satirinda
        // GORUNMEMELI, ama savunma amacli).
        await this.prisma.device
          .updateMany({
            where: { pushToken: payload.pushToken },
            data: { pushToken: null },
          })
          .catch(() => {
            // Temizlik basarisiz olsa bile ASIL gonderim sonucu (false)
            // asagida dogru donuyor - bu ikincil bir temizlik adimi.
          });
        this.logger.warn(
          `Gecersiz push token temizlendi (${code}): ${payload.pushToken.slice(0, 12)}...`,
        );
      } else {
        this.logger.warn(
          `FCM gonderim hatasi (${code ?? 'bilinmeyen'}): ${error}`,
        );
      }
      return false;
    }
  }

  private errorCode(error: unknown): string | undefined {
    if (error && typeof error === 'object' && 'code' in error) {
      return String(error.code);
    }
    return undefined;
  }
}
