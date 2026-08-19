import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCongressDto } from './create-congress.dto';

export class UpdateCongressDto extends PartialType(CreateCongressDto) {
  // Yalnizca beaconUuid GERCEKTEN degisiyorsa VE kongrede zaten beacon
  // kayitliysa anlamli - bkz. congress.service.ts update() (Faz 6.2
  // talimati §1, "409 + onayla tumunu guncelle" akisi).
  @IsOptional()
  @IsBoolean()
  migrateExistingBeacons?: boolean;
}
