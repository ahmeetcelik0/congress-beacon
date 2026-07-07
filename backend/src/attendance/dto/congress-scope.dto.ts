import { IsUUID } from 'class-validator';

export class CongressScopeDto {
  @IsUUID()
  congressId: string;
}
