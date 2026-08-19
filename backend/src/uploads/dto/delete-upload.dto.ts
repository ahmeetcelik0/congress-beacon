import { IsString, MinLength } from 'class-validator';

export class DeleteUploadDto {
  @IsString()
  @MinLength(1)
  url: string;
}
