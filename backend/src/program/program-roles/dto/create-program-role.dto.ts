import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ProgramRoleType } from '../../../../generated/prisma/client';

// sessionId/presentationId'nin ikisi birden dolu ya da ikisi birden bos
// gelmesi servis katmaninda (ProgramRolesService.resolveCongressId) 400
// olarak reddedilir - Prisma/MySQL seviyesinde CHECK kisiti yazilamadigi
// icin (bkz. schema.prisma yorumu).
export class CreateProgramRoleDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  presentationId?: string;

  @IsEnum(ProgramRoleType)
  type: ProgramRoleType;

  @IsString()
  @MinLength(1)
  rawName: string;
}
