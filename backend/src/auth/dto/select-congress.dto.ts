import { IsString, MinLength } from 'class-validator';

export class SelectCongressDto {
  @IsString()
  @MinLength(1)
  congressId: string;
}
