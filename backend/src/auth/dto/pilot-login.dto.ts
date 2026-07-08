import { IsString, Matches, MinLength } from 'class-validator';

export class PilotLoginDto {
  @IsString()
  @MinLength(2)
  congressCode: string;

  @IsString()
  @MinLength(4)
  congressAccessCode: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'phoneLast4 tam olarak 4 rakam olmalidir' })
  phoneLast4: string;
}
