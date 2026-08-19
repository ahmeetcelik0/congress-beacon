import { Injectable, Logger } from '@nestjs/common';
import {
  ExternalRegistrationDto,
  ExternalRegistrationProvider,
} from './external-registration-provider.interface';

// Dernek API'sinin gercek adaptoru yazilana kadar varsayilan saglayici -
// hicbir sey cekmez, sadece log'lar. Gercek adaptor baglanacagi zaman bu
// sinifin yerine yenisi saglanir (bkz. registrations.module.ts) - baska
// hicbir yerde kod degisikligi gerekmez (arayuz ayni kalir). BullMQ job'i/
// zamanlayici/endpoint BILINCLI OLARAK bu fazda yok (bkz. Faz 2 talimati,
// Kapsam disi) - eklenecekleri zaman bu saglayici cagrilacak.
@Injectable()
export class NoopExternalRegistrationProvider implements ExternalRegistrationProvider {
  private readonly logger = new Logger(NoopExternalRegistrationProvider.name);

  fetchRegistrations(congressId: string): Promise<ExternalRegistrationDto[]> {
    this.logger.log(
      `Dernek API'si henuz yapilandirilmadi (congressId=${congressId}) - hicbir kayit cekilmedi.`,
    );
    return Promise.resolve([]);
  }
}
