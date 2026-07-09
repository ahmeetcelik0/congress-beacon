import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { BeaconService } from './beacon.service';
import { CreateBeaconDto } from './dto/create-beacon.dto';
import { UpdateBeaconDto } from './dto/update-beacon.dto';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { AuditLogInterceptor } from '../admin-auth/audit-log.interceptor';

@Controller('beacons')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class BeaconController {
  constructor(private readonly beaconService: BeaconService) {}

  @Post()
  create(@Body() dto: CreateBeaconDto) {
    return this.beaconService.create(dto);
  }

  @Get()
  findAll(@Query('congressId') congressId?: string) {
    return this.beaconService.findAll(congressId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.beaconService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBeaconDto) {
    return this.beaconService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.beaconService.remove(id);
  }
}
