import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ProgramRoleType } from '../../../../generated/prisma/client';

// sessionId/presentationId'nin TAM OLARAK biri dolu olmasi Faz 4a'daki
// ProgramRole ile ayni sebeple (Prisma CHECK kisiti desteklemiyor) servis
// katmaninda dogrulanir - bkz. ProgramImportsService.createRole.
export class CreateProgramImportRoleDto {
  @IsOptional()
  @IsUUID()
  importSessionId?: string;

  @IsOptional()
  @IsUUID()
  importPresentationId?: string;

  @IsEnum(ProgramRoleType)
  type: ProgramRoleType;

  @IsString()
  @MinLength(2)
  rawName: string;
}
