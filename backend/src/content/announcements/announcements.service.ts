import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../../uploads/uploads.service';
import { ContentCrudService, ContentDelegate } from '../content-crud.service';
import type { Announcement } from '../../../generated/prisma/client';

@Injectable()
export class AnnouncementsService extends ContentCrudService<Announcement> {
  protected readonly delegate: ContentDelegate<Announcement>;
  // Once sabitlenmis (isPinned), sonra en son yayinlanan - bkz. Faz 3 talimati.
  protected readonly defaultOrderBy = [
    { isPinned: 'desc' as const },
    { publishedAt: 'desc' as const },
  ];

  constructor(prisma: PrismaService, uploads: UploadsService) {
    super(prisma, uploads);
    this.delegate = prisma.announcement;
  }

  // publishedAt DTO'lar UZERINDEN degistirilemez (bkz. dto yorumu) -
  // yayinla/taslak yap tek yonlu, acik eylemlerle yapilir. Boylece
  // "null gonder = taslak yap" gibi PATCH govdesinde belirsiz bir tri-state
  // kodlamaya gerek kalmaz.
  publish(id: string) {
    return this.update(id, { publishedAt: new Date() });
  }

  unpublish(id: string) {
    return this.update(id, { publishedAt: null });
  }
}
