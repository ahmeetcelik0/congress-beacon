import { IsUUID } from 'class-validator';

export class UploadImportDto {
  @IsUUID()
  congressId: string;
}
