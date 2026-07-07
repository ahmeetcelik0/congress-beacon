import { IsUUID } from 'class-validator';

export class GetBootstrapQueryDto {
  @IsUUID()
  congressId: string;
}
