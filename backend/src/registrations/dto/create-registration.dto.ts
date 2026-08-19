import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateRegistrationDto {
  @IsUUID()
  congressId: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  // E-posta veya telefon en az biri zorunlu - iki alan da opsiyonel
  // tanimlanip capraz kontrol RegistrationsService'te yapilir (Excel
  // import satir kuralinin manuel eklemedeki karsiligi).
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
