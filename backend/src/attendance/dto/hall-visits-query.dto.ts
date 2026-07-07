import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class HallVisitsQueryDto {
  @IsUUID()
  congressId: string;

  @IsOptional()
  @IsUUID()
  hallId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
