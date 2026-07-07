import { Module } from '@nestjs/common';
import { AttendanceProcessingService } from './attendance-processing.service';
import { AttendanceQueryService } from './attendance-query.service';
import { AttendanceController } from './attendance.controller';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceProcessingService, AttendanceQueryService],
  exports: [AttendanceProcessingService],
})
export class AttendanceModule {}
