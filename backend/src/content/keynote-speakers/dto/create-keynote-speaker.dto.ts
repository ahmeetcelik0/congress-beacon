import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateKeynoteSpeakerDto {
  @IsUUID()
  congressId: string;

  @IsString()
  @MinLength(1)
  fullName: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
