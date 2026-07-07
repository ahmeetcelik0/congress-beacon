import { Module } from '@nestjs/common';
import { HallController } from './hall.controller';
import { HallService } from './hall.service';
import { CongressModule } from '../congress/congress.module';

@Module({
  imports: [CongressModule],
  controllers: [HallController],
  providers: [HallService],
  exports: [HallService],
})
export class HallModule {}
