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
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { CongressQueryDto } from '../congress-query.dto';
import { ReorderDto } from '../reorder.dto';

@Controller('admin/announcements')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  list(@Query() query: CongressQueryDto) {
    return this.announcementsService.list(query.congressId);
  }

  @Post()
  create(@Body() dto: CreateAnnouncementDto) {
    const { congressId, ...data } = dto;
    return this.announcementsService.create(congressId, data);
  }

  @Post('reorder')
  async reorder(@Body() dto: ReorderDto) {
    await this.announcementsService.reorder(dto.ids);
    return { reordered: true };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcementsService.update(id, dto);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.announcementsService.publish(id);
  }

  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.announcementsService.unpublish(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.announcementsService.remove(id);
  }
}
