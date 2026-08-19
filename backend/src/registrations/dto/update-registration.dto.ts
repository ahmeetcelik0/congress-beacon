import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateRegistrationDto } from './create-registration.dto';

export class UpdateRegistrationDto extends PartialType(
  OmitType(CreateRegistrationDto, ['congressId'] as const),
) {}
