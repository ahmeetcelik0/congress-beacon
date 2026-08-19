import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminJwtGuard } from '../../admin-auth/admin-jwt.guard';
import { AuditLogInterceptor } from '../../admin-auth/audit-log.interceptor';
import { CurrentAdmin } from '../../admin-auth/current-admin.decorator';
import type { AdminUser } from '../../../generated/prisma/client';
import { ProgramImportsService } from './program-imports.service';
import { UploadProgramImportDto } from './dto/upload-program-import.dto';
import { ListProgramImportsQueryDto } from './dto/list-program-imports-query.dto';
import { ProgramImportSessionsQueryDto } from './dto/program-import-sessions-query.dto';
import { UpdateProgramImportSessionDto } from './dto/update-program-import-session.dto';
import { CreateProgramImportSessionDto } from './dto/create-program-import-session.dto';
import { UpdateProgramImportPresentationDto } from './dto/update-program-import-presentation.dto';
import { CreateProgramImportPresentationDto } from './dto/create-program-import-presentation.dto';
import { UpdateProgramImportRoleDto } from './dto/update-program-import-role.dto';
import { CreateProgramImportRoleDto } from './dto/create-program-import-role.dto';
import { ExcludeHallToCreateDto } from './dto/exclude-hall-to-create.dto';
import { CreateJsonProgramImportQueryDto } from './dto/create-json-program-import-query.dto';
import { ProgramImportMulterExceptionFilter } from './program-import-multer-exception.filter';

// Claude'un PDF istek siniriyla AYNI (bkz. claude-api becerisi "PDF (base64,
// no beta)... Limits: 32 MB request").
const MAX_FILE_SIZE_BYTES = 32 * 1024 * 1024;

@Controller('admin/program-imports')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class ProgramImportsController {
  constructor(private readonly importsService: ProgramImportsService) {}

  @Post('estimate')
  @UseFilters(ProgramImportMulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  estimate(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadProgramImportDto,
  ) {
    if (!file) {
      throw new BadRequestException('Dosya gerekli');
    }
    return this.importsService.estimate(dto.congressId, file);
  }

  @Post()
  @UseFilters(ProgramImportMulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadProgramImportDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    if (!file) {
      throw new BadRequestException('Dosya gerekli');
    }
    return this.importsService.createImport(dto.congressId, admin.id, file);
  }

  // Faz 4c §2: LLM cagrisi YOK, dosya YA DA dogrudan `application/json`
  // govdesi kabul eder - govde bir multipart dosyaysa dosya icerigi JSON
  // olarak ayristirilir, degilse `@Body()`in kendisi ExtractionResult
  // olarak degerlendirilir. Bu yuzden `congressId` govdeye KARISTIRILMAZ,
  // her iki durumda da sorgu parametresi olarak gelir.
  @Post('json')
  @UseFilters(ProgramImportMulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  createJsonImport(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: unknown,
    @Query() query: CreateJsonProgramImportQueryDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    let payload: unknown;
    let fileName: string;
    if (file) {
      fileName = file.originalname;
      try {
        payload = JSON.parse(file.buffer.toString('utf-8')) as unknown;
      } catch {
        throw new BadRequestException('Yüklenen dosya geçerli bir JSON değil');
      }
    } else {
      fileName = 'program.json';
      payload = body;
    }
    return this.importsService.createJsonImport(
      query.congressId,
      admin.id,
      fileName,
      payload,
    );
  }

  @Get('template.json')
  getTemplateJson() {
    return this.importsService.getTemplateJson();
  }

  @Get()
  list(@Query() query: ListProgramImportsQueryDto) {
    return this.importsService.listImports(query.congressId);
  }

  @Get(':id')
  getDetail(
    @Param('id') id: string,
    @Query() query: ProgramImportSessionsQueryDto,
  ) {
    return this.importsService.getImportDetail(id, query);
  }

  @Patch(':id/sessions/:sessionId')
  updateSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateProgramImportSessionDto,
  ) {
    return this.importsService.updateSessionRow(id, sessionId, dto);
  }

  @Delete(':id/sessions/:sessionId')
  excludeSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.importsService.excludeSessionRow(id, sessionId);
  }

  @Post(':id/sessions')
  createSession(
    @Param('id') id: string,
    @Body() dto: CreateProgramImportSessionDto,
  ) {
    return this.importsService.createSessionRow(id, dto);
  }

  @Patch(':id/presentations/:presentationId')
  updatePresentation(
    @Param('id') id: string,
    @Param('presentationId') presentationId: string,
    @Body() dto: UpdateProgramImportPresentationDto,
  ) {
    return this.importsService.updatePresentationRow(id, presentationId, dto);
  }

  @Delete(':id/presentations/:presentationId')
  deletePresentation(
    @Param('id') id: string,
    @Param('presentationId') presentationId: string,
  ) {
    return this.importsService.deletePresentationRow(id, presentationId);
  }

  @Post(':id/presentations')
  createPresentation(
    @Param('id') id: string,
    @Body() dto: CreateProgramImportPresentationDto,
  ) {
    return this.importsService.createPresentationRow(id, dto);
  }

  @Patch(':id/roles/:roleId')
  updateRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateProgramImportRoleDto,
  ) {
    return this.importsService.updateRoleRow(id, roleId, dto);
  }

  @Delete(':id/roles/:roleId')
  deleteRole(@Param('id') id: string, @Param('roleId') roleId: string) {
    return this.importsService.deleteRoleRow(id, roleId);
  }

  @Post(':id/roles')
  createRole(@Param('id') id: string, @Body() dto: CreateProgramImportRoleDto) {
    return this.importsService.createRoleRow(id, dto);
  }

  @Post(':id/halls-to-create/exclude')
  excludeHallToCreate(
    @Param('id') id: string,
    @Body() dto: ExcludeHallToCreateDto,
  ) {
    return this.importsService.excludeHallToCreate(id, dto.hallName);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.importsService.approveImport(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.importsService.cancelImport(id);
  }
}
