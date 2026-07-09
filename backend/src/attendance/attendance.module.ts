import { Module } from '@nestjs/common';
import { AttendanceProcessingService } from './attendance-processing.service';
import { AttendanceQueryService } from './attendance-query.service';
import { AttendanceController } from './attendance.controller';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { StaleVisitSweepService } from './stale-visit-sweep.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AttendanceController],
  providers: [
    AttendanceProcessingService,
    AttendanceQueryService,
    StaleVisitSweepService,
  ],
  exports: [AttendanceProcessingService, AttendanceQueryService],
})
export class AttendanceModule {}
