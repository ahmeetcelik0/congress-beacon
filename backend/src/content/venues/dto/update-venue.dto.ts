import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateVenueDto } from './create-venue.dto';

export class UpdateVenueDto extends PartialType(
  OmitType(CreateVenueDto, ['congressId'] as const),
) {}
