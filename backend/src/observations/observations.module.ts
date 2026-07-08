import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { ObservationsController } from './observations.controller';
import { ObservationIngestionService } from './observation-ingestion.service';
import { ObservationQueryService } from './observation-query.service';

@Module({
  imports: [AuthModule, AttendanceModule],
  controllers: [ObservationsController],
  providers: [ObservationIngestionService, ObservationQueryService],
  exports: [ObservationIngestionService],
})
export class ObservationsModule {}
