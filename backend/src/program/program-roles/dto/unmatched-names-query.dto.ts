import { IsUUID } from 'class-validator';

export class UnmatchedNamesQueryDto {
  @IsUUID()
  congressId: string;
}
