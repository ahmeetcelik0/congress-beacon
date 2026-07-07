import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class CreateHallDto {
  @IsUUID()
  congressId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(-100)
  @Max(0)
  rssiThreshold?: number;
}
