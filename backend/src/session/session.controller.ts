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
import { SessionService } from './session.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { ReorderSessionsDto } from './dto/reorder-sessions.dto';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { AuditLogInterceptor } from '../admin-auth/audit-log.interceptor';

@Controller('sessions')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  create(@Body() dto: CreateSessionDto) {
    return this.sessionService.create(dto);
  }

  @Post('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorder(@Body() dto: ReorderSessionsDto) {
    return this.sessionService.reorder(dto.ids);
  }

  @Get()
  findAll(@Query('congressId') congressId: string) {
    return this.sessionService.findAll(congressId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sessionService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.sessionService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.sessionService.remove(id);
  }
}
