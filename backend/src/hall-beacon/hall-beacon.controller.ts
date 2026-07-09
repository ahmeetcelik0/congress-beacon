import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { HallBeaconService } from './hall-beacon.service';
import { AssignHallBeaconDto } from './dto/assign-hall-beacon.dto';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { AuditLogInterceptor } from '../admin-auth/audit-log.interceptor';

@Controller('halls/:hallId/beacons')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class HallBeaconController {
  constructor(private readonly hallBeaconService: HallBeaconService) {}

  @Post(':beaconId')
  assign(
    @Param('hallId') hallId: string,
    @Param('beaconId') beaconId: string,
    @Body() dto: AssignHallBeaconDto,
  ) {
    return this.hallBeaconService.assign(hallId, beaconId, dto);
  }

  @Delete(':beaconId')
  unassign(
    @Param('hallId') hallId: string,
    @Param('beaconId') beaconId: string,
  ) {
    return this.hallBeaconService.unassign(hallId, beaconId);
  }

  @Get()
  findActive(@Param('hallId') hallId: string) {
    return this.hallBeaconService.findActiveForHall(hallId);
  }
}
