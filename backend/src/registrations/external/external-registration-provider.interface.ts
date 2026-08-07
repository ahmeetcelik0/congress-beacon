export const EXTERNAL_REGISTRATION_PROVIDER = 'EXTERNAL_REGISTRATION_PROVIDER';

export type ExternalRegistrationDto = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  externalId: string;
};

// Dernek kayit sitesinin API sozlesmesi henuz belli degil (bkz. Faz 2
// talimati) - bu arayuz yalnizca gelecekteki gercek adaptorun (ExternalId
// eslestirmesiyle CongressRegistration source=API uretecek) yerini
// tutuyor. Ayni desen: MailSender (mail/), NotificationSender
// (notifications/).
export interface ExternalRegistrationProvider {
  fetchRegistrations(congressId: string): Promise<ExternalRegistrationDto[]>;
}
