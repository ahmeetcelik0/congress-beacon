import { Controller, Get, Query } from '@nestjs/common';
import { AttendanceQueryService } from './attendance-query.service';
import { CongressScopeDto } from './dto/congress-scope.dto';
import { HallVisitsQueryDto } from './dto/hall-visits-query.dto';

@Controller('attendance')
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
}
