import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ObservedBeaconDto {
  @IsUUID()
  uuid: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  major: number;

  @IsInt()
  @Min(0)
  @Max(65535)
  minor: number;

  @IsInt()
  rssi: number;

  @IsOptional()
  @IsInt()
  txPower?: number;
}

export class ObservationSnapshotDto {
  @IsUUID()
  observationId: string;

  @IsDateString()
  observedAt: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ObservedBeaconDto)
  beacons: ObservedBeaconDto[];

  @IsOptional()
  @IsString()
  appVersion?: string;
}

export class ObservationBatchDto {
  @IsUUID()
  clientBatchId: string;

  @IsUUID()
  deviceId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ObservationSnapshotDto)
  observations: ObservationSnapshotDto[];
}
