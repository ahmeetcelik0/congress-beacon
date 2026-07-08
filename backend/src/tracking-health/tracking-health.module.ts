import { Module } from '@nestjs/common';
import { TrackingHealthController } from './tracking-health.controller';
import { TrackingHealthService } from './tracking-health.service';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

@Module({
  imports: [AdminAuthModule],
  controllers: [TrackingHealthController],
  providers: [TrackingHealthService],
})
export class TrackingHealthModule {}
