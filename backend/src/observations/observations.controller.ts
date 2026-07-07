import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../../generated/prisma/client';
import { ObservationIngestionService } from './observation-ingestion.service';
import { ObservationBatchDto } from './dto/observation-batch.dto';
import { AttendanceProcessingService } from '../attendance/attendance-processing.service';

@Controller('observations')
@UseGuards(JwtAuthGuard)
export class ObservationsController {
  constructor(
    private readonly ingestionService: ObservationIngestionService,
    private readonly attendanceProcessingService: AttendanceProcessingService,
  ) {}

  @Post('batch')
  async ingest(@CurrentUser() user: User, @Body() dto: ObservationBatchDto) {
    const result = await this.ingestionService.ingest(user, dto);

    if (result.acceptedSnapshots.length > 0) {
      await this.attendanceProcessingService.processSnapshots(user.id, result.acceptedSnapshots);
    }

    return {
      acceptedCount: result.acceptedCount,
      duplicateCount: result.duplicateCount,
      rejectedCount: result.rejectedCount,
    };
  }
}
