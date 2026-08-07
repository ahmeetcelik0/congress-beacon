import { IsString, MinLength } from 'class-validator';

// /auth/register-request ve /auth/forgot-password ayni govdeyi paylasir.
export class EmailOrPhoneDto {
  @IsString()
  @MinLength(3)
  emailOrPhone: string;
}
