import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateHallDto } from './create-hall.dto';

export class UpdateHallDto extends PartialType(
  OmitType(CreateHallDto, ['congressId'] as const),
) {}
