import { IsUUID } from 'class-validator';

export class ListImportsQueryDto {
  @IsUUID()
  congressId: string;
}
