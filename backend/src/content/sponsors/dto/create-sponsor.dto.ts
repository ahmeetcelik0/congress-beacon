import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { SponsorTier } from '../../../../generated/prisma/client';

export class CreateSponsorDto {
  @IsUUID()
  congressId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsEnum(SponsorTier)
  tier?: SponsorTier;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
