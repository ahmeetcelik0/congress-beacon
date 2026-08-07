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
import { InfoSectionsService } from './info-sections.service';
import { CreateInfoSectionDto } from './dto/create-info-section.dto';
import { UpdateInfoSectionDto } from './dto/update-info-section.dto';
import { CongressQueryDto } from '../congress-query.dto';
import { ReorderDto } from '../reorder.dto';

@Controller('admin/info-sections')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class InfoSectionsController {
  constructor(private readonly infoSectionsService: InfoSectionsService) {}

  @Get()
  list(@Query() query: CongressQueryDto) {
    return this.infoSectionsService.list(query.congressId);
  }

  @Post()
  create(@Body() dto: CreateInfoSectionDto) {
    const { congressId, ...data } = dto;
    return this.infoSectionsService.create(congressId, data);
  }

  @Post('reorder')
  async reorder(@Body() dto: ReorderDto) {
    await this.infoSectionsService.reorder(dto.ids);
    return { reordered: true };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInfoSectionDto) {
    return this.infoSectionsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.infoSectionsService.remove(id);
  }
}
