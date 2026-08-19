import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'node:path';
import { AdminJwtGuard } from '../../admin-auth/admin-jwt.guard';
import { AuditLogInterceptor } from '../../admin-auth/audit-log.interceptor';
import { CurrentAdmin } from '../../admin-auth/current-admin.decorator';
import type { AdminUser } from '../../../generated/prisma/client';
import { RegistrationImportService } from './registration-import.service';
import { UploadImportDto } from '../dto/upload-import.dto';
import { ListImportsQueryDto } from '../dto/list-imports-query.dto';
import { ImportRowsQueryDto } from '../dto/import-rows-query.dto';
import { UpdateImportRowDto } from '../dto/update-import-row.dto';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv']);

@Controller('admin/registrations/imports')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class RegistrationImportController {
  constructor(private readonly importService: RegistrationImportService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadImportDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    if (!file) {
      throw new BadRequestException('Dosya gerekli');
    }
    if (!ALLOWED_EXTENSIONS.has(extname(file.originalname).toLowerCase())) {
      throw new BadRequestException('Desteklenen formatlar: .xlsx, .xls, .csv');
    }

    return this.importService.createImport(dto.congressId, admin.id, file);
  }

  @Get()
  list(@Query() query: ListImportsQueryDto) {
    return this.importService.listImports(query.congressId);
  }

  @Get(':id')
  getDetail(@Param('id') id: string, @Query() query: ImportRowsQueryDto) {
    return this.importService.getImportDetail(id, query);
  }

  @Patch(':id/rows/:rowId')
  updateRow(
    @Param('id') id: string,
    @Param('rowId') rowId: string,
    @Body() dto: UpdateImportRowDto,
  ) {
    return this.importService.updateRow(id, rowId, dto);
  }

  @Post(':id/rows/:rowId/exclude')
  excludeRow(@Param('id') id: string, @Param('rowId') rowId: string) {
    return this.importService.excludeRow(id, rowId);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.importService.approveImport(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.importService.cancelImport(id);
  }
}
