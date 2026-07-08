import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TrackingHealthService } from './tracking-health.service';
import { CongressScopeDto } from '../attendance/dto/congress-scope.dto';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';

@Controller('admin/tracking-health')
@UseGuards(AdminJwtGuard)
export class TrackingHealthController {
  constructor(private readonly trackingHealthService: TrackingHealthService) {}

  @Get()
  get(@Query() query: CongressScopeDto) {
    return this.trackingHealthService.getTrackingHealth(query.congressId);
  }
}
