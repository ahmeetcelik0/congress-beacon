import { IsUUID } from 'class-validator';

export class RematchDto {
  @IsUUID()
  congressId: string;
}
