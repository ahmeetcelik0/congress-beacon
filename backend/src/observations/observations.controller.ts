import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../../generated/prisma/client';
import { ObservationIngestionService } from './observation-ingestion.service';
import { ObservationQueryService } from './observation-query.service';
import { ObservationBatchDto } from './dto/observation-batch.dto';
import { ObservationsQueryDto } from './dto/observations-query.dto';
import { AttendanceProcessingService } from '../attendance/attendance-processing.service';

@Controller('observations')
export class ObservationsController {
  constructor(
    private readonly ingestionService: ObservationIngestionService,
    private readonly attendanceProcessingService: AttendanceProcessingService,
    private readonly queryService: ObservationQueryService,
  ) {}

  @Get()
  getObservations(@Query() query: ObservationsQueryDto) {
    return this.queryService.getObservations(query);
  }

  @Post('batch')
  @UseGuards(JwtAuthGuard)
  async ingest(@CurrentUser() user: User, @Body() dto: ObservationBatchDto) {
    const result = await this.ingestionService.ingest(user, dto);

    if (result.acceptedSnapshots.length > 0) {
      await this.attendanceProcessingService.processSnapshots(
        user.id,
        result.acceptedSnapshots,
      );
    }

    return {
      acceptedCount: result.acceptedCount,
      duplicateCount: result.duplicateCount,
      rejectedCount: result.rejectedCount,
    };
  }
}
