import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

// Tum alanlar opsiyonel - yalnizca gonderilenler guncellenir. Guncelleme
// sonrasi status/warning her zaman MEVCUT alan degerlerinden YENIDEN
// hesaplanir (bkz. ProgramImportsService.reviseSessionRow) - "onceden
// turetilmis miydi" gibi bir gecmis takip edilmez, bu daha basit ve
// saglamdir.
export class UpdateProgramImportSessionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUUID()
  hallId?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  sessionType?: string;

  @IsOptional()
  @IsString()
  dayLabel?: string;

  @IsOptional()
  @IsString()
  keywords?: string;
}
