import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AttendanceQueryService } from './attendance-query.service';
import { CongressScopeDto } from './dto/congress-scope.dto';
import { HallVisitsQueryDto } from './dto/hall-visits-query.dto';
import { OccupancySeriesQueryDto } from './dto/occupancy-series-query.dto';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';

@Controller('attendance')
@UseGuards(AdminJwtGuard)
export class AttendanceController {
  constructor(private readonly queryService: AttendanceQueryService) {}

  @Get('summary')
  getSummary(@Query() query: CongressScopeDto) {
    return this.queryService.getSummary(query.congressId);
  }

  @Get('hall-visits')
  getHallVisits(@Query() query: HallVisitsQueryDto) {
    return this.queryService.getHallVisits(query);
  }

  @Get('hall-visits/:id/trace')
  getHallVisitTrace(@Param('id') id: string) {
    return this.queryService.getVisitTrace(id);
  }

  @Get('users/:userId/summary')
  getUserSummary(@Param('userId') userId: string) {
    return this.queryService.getUserSummary(userId);
  }

  @Get('occupancy-series')
  getOccupancySeries(@Query() query: OccupancySeriesQueryDto) {
    return this.queryService.getOccupancySeries(query);
  }
}
