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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CongressService } from './congress.service';
import { CreateCongressDto } from './dto/create-congress.dto';
import { UpdateCongressDto } from './dto/update-congress.dto';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { AuditLogInterceptor } from '../admin-auth/audit-log.interceptor';

@Controller('congresses')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class CongressController {
  constructor(private readonly congressService: CongressService) {}

  @Post()
  create(@Body() dto: CreateCongressDto) {
    return this.congressService.create(dto);
  }

  @Get()
  findAll() {
    return this.congressService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.congressService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCongressDto) {
    return this.congressService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.congressService.remove(id);
  }
}
