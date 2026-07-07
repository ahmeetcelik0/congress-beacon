import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateBeaconDto {
  @IsUUID()
  congressId: string;

  @IsUUID()
  uuid: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  major: number;

  @IsInt()
  @Min(0)
  @Max(65535)
  minor: number;

  @IsOptional()
  @IsString()
  label?: string;
}
