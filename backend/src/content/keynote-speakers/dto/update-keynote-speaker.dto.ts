import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateKeynoteSpeakerDto } from './create-keynote-speaker.dto';

export class UpdateKeynoteSpeakerDto extends PartialType(
  OmitType(CreateKeynoteSpeakerDto, ['congressId'] as const),
) {}
