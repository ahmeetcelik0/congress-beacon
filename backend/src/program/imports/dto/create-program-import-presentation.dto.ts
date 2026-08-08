import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateProgramImportPresentationDto {
  @IsUUID()
  importSessionId: string;

  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;
}
