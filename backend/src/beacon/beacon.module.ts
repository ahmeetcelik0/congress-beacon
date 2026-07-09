import { Module } from '@nestjs/common';
import { BeaconController } from './beacon.controller';
import { BeaconService } from './beacon.service';
import { CongressModule } from '../congress/congress.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

@Module({
  imports: [CongressModule, AdminAuthModule],
  controllers: [BeaconController],
  providers: [BeaconService],
  exports: [BeaconService],
})
export class BeaconModule {}
