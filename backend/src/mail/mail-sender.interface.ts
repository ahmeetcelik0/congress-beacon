export const MAIL_SENDER = 'MAIL_SENDER';

export interface MailSender {
  sendVerificationCode(to: string, code: string): Promise<void>;
}
