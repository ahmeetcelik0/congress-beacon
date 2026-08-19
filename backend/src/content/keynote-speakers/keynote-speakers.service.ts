import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../../uploads/uploads.service';
import { ContentCrudService, ContentDelegate } from '../content-crud.service';
import type { KeynoteSpeaker } from '../../../generated/prisma/client';

@Injectable()
export class KeynoteSpeakersService extends ContentCrudService<KeynoteSpeaker> {
  protected readonly delegate: ContentDelegate<KeynoteSpeaker>;
  protected readonly defaultOrderBy = { displayOrder: 'asc' as const };
  protected readonly imageField = 'photoUrl' as const;

  constructor(prisma: PrismaService, uploads: UploadsService) {
    super(prisma, uploads);
    this.delegate = prisma.keynoteSpeaker;
  }
}
