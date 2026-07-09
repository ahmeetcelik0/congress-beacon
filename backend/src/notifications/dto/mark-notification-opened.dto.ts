import { IsUUID } from 'class-validator';

export class MarkNotificationOpenedDto {
  @IsUUID()
  notificationLogId: string;
}
