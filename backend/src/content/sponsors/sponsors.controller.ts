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
import { SponsorsService } from './sponsors.service';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { CongressQueryDto } from '../congress-query.dto';
import { ReorderDto } from '../reorder.dto';

@Controller('admin/sponsors')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class SponsorsController {
  constructor(private readonly sponsorsService: SponsorsService) {}

  @Get()
  list(@Query() query: CongressQueryDto) {
    return this.sponsorsService.list(query.congressId);
  }

  @Post()
  create(@Body() dto: CreateSponsorDto) {
    const { congressId, ...data } = dto;
    return this.sponsorsService.create(congressId, data);
  }

  @Post('reorder')
  async reorder(@Body() dto: ReorderDto) {
    await this.sponsorsService.reorder(dto.ids);
    return { reordered: true };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSponsorDto) {
    return this.sponsorsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.sponsorsService.remove(id);
  }
}
