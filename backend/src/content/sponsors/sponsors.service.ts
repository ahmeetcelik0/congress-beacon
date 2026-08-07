import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../../uploads/uploads.service';
import { ContentCrudService, ContentDelegate } from '../content-crud.service';
import type { Sponsor } from '../../../generated/prisma/client';

@Injectable()
export class SponsorsService extends ContentCrudService<Sponsor> {
  protected readonly delegate: ContentDelegate<Sponsor>;
  // SponsorTier enum'i schema.prisma'da BILINCLI olarak prestij sirasiyla
  // tanimli (PLATINUM..SUPPORTER) - MySQL ENUM kolonlarinda varsayilan
  // siralama tanim sirasidir, bu yuzden `tier: 'asc'` dogrudan istenen
  // prestij sirasini verir (bkz. docs/decisions.md).
  protected readonly defaultOrderBy = [
    { tier: 'asc' as const },
    { displayOrder: 'asc' as const },
  ];
  protected readonly imageField = 'logoUrl' as const;

  constructor(prisma: PrismaService, uploads: UploadsService) {
    super(prisma, uploads);
    this.delegate = prisma.sponsor;
  }
}
