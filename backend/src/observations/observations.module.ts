import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { ObservationsController } from './observations.controller';
import { ObservationIngestionService } from './observation-ingestion.service';
import { ObservationQueryService } from './observation-query.service';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

@Module({
  imports: [AuthModule, AttendanceModule, AdminAuthModule],
  controllers: [ObservationsController],
  providers: [ObservationIngestionService, ObservationQueryService],
  exports: [ObservationIngestionService],
})
export class ObservationsModule {}
