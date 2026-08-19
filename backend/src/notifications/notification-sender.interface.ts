export const NOTIFICATION_SENDER = 'NOTIFICATION_SENDER';

export type NotificationPayload = {
  pushToken: string;
  title: string;
  body: string;
  // Faz 9: mobil derin-baglanti icin (bkz. Faz 9 talimati §5) - FCM'in
  // "data" alanina aynen aktarilir. Opsiyonel: LoggingNotificationSender
  // ve gecmis cagri yerleri bunu vermeden de calismaya devam eder.
  // Birlestirilmis (birden fazla oturumu kapsayan) bildirimlerde
  // `sessionId` BILEREK atlanir - mobil taraf boyle bir durumda programa
  // yonlendirmeye duser (bkz. notification-scheduler.service.ts).
  data?: Record<string, string>;
};

export interface NotificationSender {
  send(payload: NotificationPayload): Promise<boolean>;
}
