import { IsUUID } from 'class-validator';

export class CongressQueryDto {
  @IsUUID()
  congressId: string;
}
