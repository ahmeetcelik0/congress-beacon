import { IsString, IsUUID, MinLength } from 'class-validator';

export class UpdatePushTokenDto {
  @IsUUID()
  deviceId: string;

  @IsString()
  @MinLength(1)
  pushToken: string;
}
