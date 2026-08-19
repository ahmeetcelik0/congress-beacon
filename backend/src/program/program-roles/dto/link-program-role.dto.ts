import { IsUUID } from 'class-validator';

export class LinkProgramRoleDto {
  @IsUUID()
  userId: string;
}
