import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateAnnouncementDto } from './create-announcement.dto';

export class UpdateAnnouncementDto extends PartialType(
  OmitType(CreateAnnouncementDto, ['congressId'] as const),
) {}
