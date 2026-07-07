import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { ObservationsController } from './observations.controller';
import { ObservationIngestionService } from './observation-ingestion.service';

@Module({
  imports: [AuthModule, AttendanceModule],
  controllers: [ObservationsController],
  providers: [ObservationIngestionService],
  exports: [ObservationIngestionService],
})
export class ObservationsModule {}
