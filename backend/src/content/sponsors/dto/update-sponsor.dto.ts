import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateSponsorDto } from './create-sponsor.dto';

export class UpdateSponsorDto extends PartialType(
  OmitType(CreateSponsorDto, ['congressId'] as const),
) {}
