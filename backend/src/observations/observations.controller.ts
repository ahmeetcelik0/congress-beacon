import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../../generated/prisma/client';
import { ObservationIngestionService } from './observation-ingestion.service';
import { ObservationBatchDto } from './dto/observation-batch.dto';

@Controller('observations')
@UseGuards(JwtAuthGuard)
export class ObservationsController {
  constructor(private readonly ingestionService: ObservationIngestionService) {}

  @Post('batch')
  async ingest(@CurrentUser() user: User, @Body() dto: ObservationBatchDto) {
    const result = await this.ingestionService.ingest(user, dto);
    return {
      acceptedCount: result.acceptedCount,
      duplicateCount: result.duplicateCount,
      rejectedCount: result.rejectedCount,
    };
  }
}
