import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { AuditLogInterceptor } from '../admin-auth/audit-log.interceptor';
import { UploadsService, MAX_UPLOAD_SIZE_BYTES } from './uploads.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { DeleteUploadDto } from './dto/delete-upload.dto';
import { MulterExceptionFilter } from './multer-exception.filter';

@Controller('admin/uploads')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('Dosya gerekli');
    }
    return this.uploadsService.saveFile(dto.congressId, file);
  }

  @Delete()
  async remove(@Body() dto: DeleteUploadDto) {
    await this.uploadsService.deleteFile(dto.url);
    return { deleted: true };
  }
}
