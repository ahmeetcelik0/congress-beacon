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
import { HallService } from './hall.service';
import { CreateHallDto } from './dto/create-hall.dto';
import { UpdateHallDto } from './dto/update-hall.dto';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { AuditLogInterceptor } from '../admin-auth/audit-log.interceptor';

@Controller('halls')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class HallController {
  constructor(private readonly hallService: HallService) {}

  @Post()
  create(@Body() dto: CreateHallDto) {
    return this.hallService.create(dto);
  }

  @Get()
  findAll(@Query('congressId') congressId?: string) {
    return this.hallService.findAll(congressId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hallService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHallDto) {
    return this.hallService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.hallService.remove(id);
  }
}
