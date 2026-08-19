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
import { PresentationsService } from './presentations.service';
import { CreatePresentationDto } from './dto/create-presentation.dto';
import { UpdatePresentationDto } from './dto/update-presentation.dto';
import { ReorderPresentationsDto } from './dto/reorder-presentations.dto';
import { AdminJwtGuard } from '../../admin-auth/admin-jwt.guard';
import { AuditLogInterceptor } from '../../admin-auth/audit-log.interceptor';

@Controller('admin/presentations')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class PresentationsController {
  constructor(private readonly presentationsService: PresentationsService) {}

  @Get()
  list(@Query('sessionId') sessionId: string) {
    return this.presentationsService.list(sessionId);
  }

  @Post()
  create(@Body() dto: CreatePresentationDto) {
    return this.presentationsService.create(dto);
  }

  @Post('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorder(@Body() dto: ReorderPresentationsDto) {
    return this.presentationsService.reorder(dto.ids);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePresentationDto) {
    return this.presentationsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.presentationsService.remove(id);
  }
}
