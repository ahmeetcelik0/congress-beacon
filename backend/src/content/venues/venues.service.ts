import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../../uploads/uploads.service';
import { ContentCrudService, ContentDelegate } from '../content-crud.service';
import type { Venue } from '../../../generated/prisma/client';

@Injectable()
export class VenuesService extends ContentCrudService<Venue> {
  protected readonly delegate: ContentDelegate<Venue>;
  protected readonly defaultOrderBy = { displayOrder: 'asc' as const };
  protected readonly imageField = 'imageUrl' as const;

  constructor(prisma: PrismaService, uploads: UploadsService) {
    super(prisma, uploads);
    this.delegate = prisma.venue;
  }
}
