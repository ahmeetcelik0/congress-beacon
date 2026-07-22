import { Module } from '@nestjs/common';
import { TrackingHealthController } from './tracking-health.controller';
import { TrackingHealthService } from './tracking-health.service';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  // BeaconSignalStore (Redis'teki outlier sayaclari) icin.
  imports: [AdminAuthModule, AttendanceModule],
  controllers: [TrackingHealthController],
  providers: [TrackingHealthService],
})
export class TrackingHealthModule {}
