import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../../uploads/uploads.service';
import { ContentCrudService, ContentDelegate } from '../content-crud.service';
import type { CongressInfoSection } from '../../../generated/prisma/client';

@Injectable()
export class InfoSectionsService extends ContentCrudService<CongressInfoSection> {
  protected readonly delegate: ContentDelegate<CongressInfoSection>;
  protected readonly defaultOrderBy = { displayOrder: 'asc' as const };
  // Gorsel tasimiyor - imageField tanimsiz birakilir, temizlik adimi hic calismaz.

  constructor(prisma: PrismaService, uploads: UploadsService) {
    super(prisma, uploads);
    this.delegate = prisma.congressInfoSection;
  }
}
