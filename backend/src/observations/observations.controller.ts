import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveCongressGuard } from '../auth/active-congress.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-request';
import { ObservationIngestionService } from './observation-ingestion.service';
import { ObservationQueryService } from './observation-query.service';
import { ObservationBatchDto } from './dto/observation-batch.dto';
import { ObservationsQueryDto } from './dto/observations-query.dto';
import { AttendanceProcessingService } from '../attendance/attendance-processing.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';

@Controller('observations')
export class ObservationsController {
  constructor(
    private readonly ingestionService: ObservationIngestionService,
    private readonly attendanceProcessingService: AttendanceProcessingService,
    private readonly queryService: ObservationQueryService,
  ) {}

  @Get()
  @UseGuards(AdminJwtGuard)
  getObservations(@Query() query: ObservationsQueryDto) {
    return this.queryService.getObservations(query);
  }

  @Post('batch')
  @UseGuards(JwtAuthGuard, ActiveCongressGuard)
  async ingest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ObservationBatchDto,
  ) {
    const result = await this.ingestionService.ingest(user, dto);

    if (result.acceptedSnapshots.length > 0) {
      // ActiveCongressGuard congressId'nin dolu olmasini zaten garanti eder.
      await this.attendanceProcessingService.processSnapshots(
        user.id,
        user.congressId as string,
        result.acceptedSnapshots,
      );
    }

    return {
      acceptedCount: result.acceptedCount,
      duplicateCount: result.duplicateCount,
      rejectedCount: result.rejectedCount,
      observationIntervalSeconds: result.observationIntervalSeconds,
    };
  }
}
