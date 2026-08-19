import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

// Yetkilinin panelden elle oturum eklemesi icin (LLM bir oturumu atladiysa).
// Manuel eklenen bir satir daima status=NEW ile baslar - LLM cikarimindan
// gelmedigi icin dogrulanacak bir "belgede neydi" durumu yoktur.
export class CreateProgramImportSessionDto {
  @IsString()
  @MinLength(2)
  title: string;

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
