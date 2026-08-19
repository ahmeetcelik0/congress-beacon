import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateInfoSectionDto {
  @IsUUID()
  congressId: string;

  @IsString()
  @MinLength(1)
  title: string;

  // Markdown olarak saklanir, mobil tarafta render edilir.
  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
