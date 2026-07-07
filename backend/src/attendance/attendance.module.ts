import { Module } from '@nestjs/common';
import { AttendanceProcessingService } from './attendance-processing.service';

@Module({
  providers: [AttendanceProcessingService],
  exports: [AttendanceProcessingService],
})
export class AttendanceModule {}
