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
import { KeynoteSpeakersService } from './keynote-speakers.service';
import { CreateKeynoteSpeakerDto } from './dto/create-keynote-speaker.dto';
import { UpdateKeynoteSpeakerDto } from './dto/update-keynote-speaker.dto';
import { CongressQueryDto } from '../congress-query.dto';
import { ReorderDto } from '../reorder.dto';

@Controller('admin/keynote-speakers')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class KeynoteSpeakersController {
  constructor(
    private readonly keynoteSpeakersService: KeynoteSpeakersService,
  ) {}

  @Get()
  list(@Query() query: CongressQueryDto) {
    return this.keynoteSpeakersService.list(query.congressId);
  }

  @Post()
  create(@Body() dto: CreateKeynoteSpeakerDto) {
    const { congressId, ...data } = dto;
    return this.keynoteSpeakersService.create(congressId, data);
  }

  @Post('reorder')
  async reorder(@Body() dto: ReorderDto) {
    await this.keynoteSpeakersService.reorder(dto.ids);
    return { reordered: true };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateKeynoteSpeakerDto) {
    return this.keynoteSpeakersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.keynoteSpeakersService.remove(id);
  }
}
