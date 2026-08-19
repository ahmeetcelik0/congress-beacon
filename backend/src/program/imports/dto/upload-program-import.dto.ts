import { IsUUID } from 'class-validator';

export class UploadProgramImportDto {
  @IsUUID()
  congressId: string;
}
