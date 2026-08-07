import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ImportRowStatus } from '../../../generated/prisma/client';

export class ImportRowsQueryDto {
  @IsOptional()
  @IsEnum(ImportRowStatus)
  status?: ImportRowStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number = 50;
}
