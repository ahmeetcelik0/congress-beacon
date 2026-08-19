import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { RegistrationImportController } from './imports/registration-import.controller';
import { RegistrationImportService } from './imports/registration-import.service';
import { RegistrationImportParserService } from './imports/registration-import-parser.service';
import { EXTERNAL_REGISTRATION_PROVIDER } from './external/external-registration-provider.interface';
import { NoopExternalRegistrationProvider } from './external/noop-external-registration-provider';

@Module({
  imports: [AdminAuthModule],
  controllers: [RegistrationsController, RegistrationImportController],
  providers: [
    RegistrationsService,
    RegistrationImportService,
    RegistrationImportParserService,
    {
      provide: EXTERNAL_REGISTRATION_PROVIDER,
      useClass: NoopExternalRegistrationProvider,
    },
  ],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
