import { IsUUID } from 'class-validator';

// `congressId` sorgu parametresi olarak tasinir - govde iki farkli sekilde
// gelebilir (multipart dosya YA DA dogrudan `application/json` govdesi,
// bkz. Faz 4c talimati §2) ve her iki durumda da govdenin TAMAMI
// ExtractionResult'in kendisidir, congressId gibi bir meta alanla
// KARISTIRILMAZ.
export class CreateJsonProgramImportQueryDto {
  @IsUUID()
  congressId: string;
}
