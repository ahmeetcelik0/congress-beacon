export const NOTIFICATION_SENDER = 'NOTIFICATION_SENDER';

export type NotificationPayload = {
  pushToken: string;
  title: string;
  body: string;
};

export interface NotificationSender {
  send(payload: NotificationPayload): Promise<boolean>;
}
