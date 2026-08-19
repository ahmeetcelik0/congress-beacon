import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { VenuesController } from './venues/venues.controller';
import { VenuesService } from './venues/venues.service';
import { AnnouncementsController } from './announcements/announcements.controller';
import { AnnouncementsService } from './announcements/announcements.service';
import { SponsorsController } from './sponsors/sponsors.controller';
import { SponsorsService } from './sponsors/sponsors.service';
import { KeynoteSpeakersController } from './keynote-speakers/keynote-speakers.controller';
import { KeynoteSpeakersService } from './keynote-speakers/keynote-speakers.service';
import { InfoSectionsController } from './info-sections/info-sections.controller';
import { InfoSectionsService } from './info-sections/info-sections.service';

@Module({
  imports: [AdminAuthModule, UploadsModule],
  controllers: [
    VenuesController,
    AnnouncementsController,
    SponsorsController,
    KeynoteSpeakersController,
    InfoSectionsController,
  ],
  providers: [
    VenuesService,
    AnnouncementsService,
    SponsorsService,
    KeynoteSpeakersService,
    InfoSectionsService,
  ],
})
export class ContentModule {}
