import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateBeaconDto } from './create-beacon.dto';

export class UpdateBeaconDto extends PartialType(
  OmitType(CreateBeaconDto, ['congressId'] as const),
) {}
