import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AssignHallBeaconDto {
  @IsOptional()
  @IsInt()
  @Min(-100)
  @Max(0)
  rssiThreshold?: number;

  @IsOptional()
  @IsString()
  calibrationNote?: string;

  @IsOptional()
  @IsString()
  placementNote?: string;
}
