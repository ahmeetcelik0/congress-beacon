import { IsOptional, IsString } from 'class-validator';

// Alanlar PATCH semantigiyle opsiyonel: gonderilmeyen alan degismez,
// gonderilen bos string ise (dosyadaki gibi) o alan bosaltilir. Kaydettikten
// sonra durum ve uyari RegistrationImportService icinde yeniden hesaplanir.
export class UpdateImportRowDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
