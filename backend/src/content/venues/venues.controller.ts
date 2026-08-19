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
import { AdminJwtGuard } from '../../admin-auth/admin-jwt.guard';
import { AuditLogInterceptor } from '../../admin-auth/audit-log.interceptor';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { CongressQueryDto } from '../congress-query.dto';
import { ReorderDto } from '../reorder.dto';

@Controller('admin/venues')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Get()
  list(@Query() query: CongressQueryDto) {
    return this.venuesService.list(query.congressId);
  }

  @Post()
  create(@Body() dto: CreateVenueDto) {
    const { congressId, ...data } = dto;
    return this.venuesService.create(congressId, data);
  }

  @Post('reorder')
  async reorder(@Body() dto: ReorderDto) {
    await this.venuesService.reorder(dto.ids);
    return { reordered: true };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVenueDto) {
    return this.venuesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.venuesService.remove(id);
  }
}
