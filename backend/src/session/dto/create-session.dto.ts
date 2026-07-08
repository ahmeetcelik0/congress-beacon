import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
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
}
