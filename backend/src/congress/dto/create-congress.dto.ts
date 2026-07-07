import { IsDateString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCongressDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsUUID()
  beaconUuid: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
