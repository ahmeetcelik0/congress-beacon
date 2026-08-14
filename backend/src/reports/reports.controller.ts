import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { CongressScopeDto } from '../attendance/dto/congress-scope.dto';
import { HallVisitsCsvQueryDto } from './dto/hall-visits-csv-query.dto';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';

@Controller('reports')
@UseGuards(AdminJwtGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('data-quality')
  getDataQuality(@Query() query: CongressScopeDto) {
    return this.reportsService.getDataQuality(query.congressId);
  }

  @Get('beacon-health')
  getBeaconHealth(@Query() query: CongressScopeDto) {
    return this.reportsService.getBeaconHealth(query.congressId);
  }

  @Get('notifications')
  getNotificationSummary(@Query() query: CongressScopeDto) {
    return this.reportsService.getNotificationSummary(query.congressId);
  }

  @Get('hall-visits.csv')
  async getHallVisitsCsv(
    @Query() query: HallVisitsCsvQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.reportsService.getHallVisitsCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="hall-visits.csv"',
    );
    res.send(csv);
  }
}
