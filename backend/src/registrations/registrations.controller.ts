import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { AuditLogInterceptor } from '../admin-auth/audit-log.interceptor';
import { RegistrationsService } from './registrations.service';
import { RegistrationsQueryDto } from './dto/registrations-query.dto';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { buildRegistrationTemplate } from './imports/build-registration-template';

@Controller('admin/registrations')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Get('template.xlsx')
  getTemplate(@Res() res: Response) {
    const buffer = buildRegistrationTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="katilimci-sablonu.xlsx"',
    );
    res.send(buffer);
  }

  @Get()
  list(@Query() query: RegistrationsQueryDto) {
    return this.registrationsService.list(query);
  }

  @Post()
  create(@Body() dto: CreateRegistrationDto) {
    return this.registrationsService.createManual(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRegistrationDto) {
    return this.registrationsService.update(id, dto);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.registrationsService.deactivate(id);
  }

  @Post(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.registrationsService.reactivate(id);
  }
}
