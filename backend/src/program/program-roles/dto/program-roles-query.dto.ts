import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { RoleMatchStatus } from '../../../../generated/prisma/client';

export class ProgramRolesQueryDto {
  @IsUUID()
  congressId: string;

  @IsOptional()
  @IsEnum(RoleMatchStatus)
  status?: RoleMatchStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 20;
}
