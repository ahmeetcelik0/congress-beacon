import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ProgramRoleType } from '../../../../generated/prisma/client';

// sessionId/presentationId burada YOK - bir rolun hangi oturuma/sunuma
// bagli oldugu degistirilemez (yeniden atamak icin sil + yeniden olustur).
// rawName degisirse eslesme otomatik yeniden hesaplanir (bkz. servis).
export class UpdateProgramRoleDto {
  @IsOptional()
  @IsEnum(ProgramRoleType)
  type?: ProgramRoleType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  rawName?: string;
}
