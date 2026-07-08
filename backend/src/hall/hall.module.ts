import { Module } from '@nestjs/common';
import { HallController } from './hall.controller';
import { HallService } from './hall.service';
import { CongressModule } from '../congress/congress.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

@Module({
  imports: [CongressModule, AdminAuthModule],
  controllers: [HallController],
  providers: [HallService],
  exports: [HallService],
})
export class HallModule {}
