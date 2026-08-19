import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSessionDto {
  @IsUUID()
  congressId: string;

  @IsUUID()
  hallId: string;

  @IsString()
  @MinLength(2)
  title: string;

  // DEPRECATED: yeni programlarda moderator/konusmaci ProgramRole uzerinden
  // eklenir (bkz. /admin/program-roles). Alan yalnizca eski veri/panel
  // gorunumu icin korunuyor.
  @IsOptional()
  @IsString()
  speaker?: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  description?: string;

  // --- Faz 4a: iki seviyeli bilimsel program alanlari ---
  @IsOptional()
  @IsString()
  sessionType?: string;

  @IsOptional()
  @IsString()
  dayLabel?: string;

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
