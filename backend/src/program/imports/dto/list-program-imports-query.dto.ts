import { IsUUID } from 'class-validator';

export class ListProgramImportsQueryDto {
  @IsUUID()
  congressId: string;
}
