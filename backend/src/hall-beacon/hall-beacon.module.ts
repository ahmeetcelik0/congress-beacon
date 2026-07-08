import { Module } from '@nestjs/common';
import { HallBeaconController } from './hall-beacon.controller';
import { HallBeaconService } from './hall-beacon.service';
import { HallModule } from '../hall/hall.module';
import { BeaconModule } from '../beacon/beacon.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

@Module({
  imports: [HallModule, BeaconModule, AdminAuthModule],
  controllers: [HallBeaconController],
  providers: [HallBeaconService],
  exports: [HallBeaconService],
})
export class HallBeaconModule {}
