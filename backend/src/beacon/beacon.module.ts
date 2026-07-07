import { Module } from '@nestjs/common';
import { BeaconController } from './beacon.controller';
import { BeaconService } from './beacon.service';
import { CongressModule } from '../congress/congress.module';

@Module({
  imports: [CongressModule],
  controllers: [BeaconController],
  providers: [BeaconService],
  exports: [BeaconService],
})
export class BeaconModule {}
