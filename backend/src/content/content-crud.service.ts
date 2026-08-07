import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import type { Prisma } from '../../generated/prisma/client';

// Venue/Announcement/Sponsor/KeynoteSpeaker/CongressInfoSection'in BESI de
// ayni CRUD iskeletini paylasir: kongre dogrulama, congressId'ye gore
// listeleme+siralama, gorsel alani degistiginde/kayit silinince eski
// dosyayi diskten temizleme, reorder. Prisma her model icin AYRI, guclu
// tipli bir delegate uretir (Venue delegate'i Sponsor delegate'inden farkli
// bir TS tipidir) - bu yuzden burada BILINCLI olarak gevsek (loosely)
// tipli kucuk bir arayuzle calisilir; tip guvenligi asil CAGIRAN tarafta
// (her alt servisin kendi DTO'lari, `this.delegate = this.prisma.venue`
// gibi somut atamalar) saglanir.

type Loose = any;

export type ContentDelegate<TModel> = {
  findMany(args: {
    where: { congressId: string };
    orderBy: Loose;
  }): Prisma.PrismaPromise<TModel[]>;
  findUnique(args: {
    where: { id: string };
  }): Prisma.PrismaPromise<TModel | null>;
  create(args: { data: Loose }): Prisma.PrismaPromise<TModel>;
  update(args: {
    where: { id: string };
    data: Loose;
  }): Prisma.PrismaPromise<TModel>;
  delete(args: { where: { id: string } }): Prisma.PrismaPromise<TModel>;
};

export abstract class ContentCrudService<
  TModel extends { id: string; congressId: string },
> {
  protected abstract readonly delegate: ContentDelegate<TModel>;
  protected abstract readonly defaultOrderBy: unknown;
  // Gorsel tasiyan tur (Venue.imageUrl, Sponsor.logoUrl, ...) icin alan
  // adi - tanimliysa silme/degistirmede eski dosya otomatik temizlenir.
  // Tanimsizsa (Announcement/CongressInfoSection gibi gorselsiz turlerde)
  // temizlik adimi hic calismaz.
  protected readonly imageField?: keyof TModel;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly uploads: UploadsService,
  ) {}

  async list(congressId: string): Promise<TModel[]> {
    return this.delegate.findMany({
      where: { congressId },
      orderBy: this.defaultOrderBy,
    });
  }

  protected async assertCongressExists(congressId: string): Promise<void> {
    const congress = await this.prisma.congress.findUnique({
      where: { id: congressId },
      select: { id: true },
    });
    if (!congress) {
      throw new NotFoundException('Kongre bulunamadi');
    }
  }

  protected async findOrThrow(id: string): Promise<TModel> {
    const record = await this.delegate.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException('Kayit bulunamadi');
    }
    return record;
  }

  async create(congressId: string, data: object): Promise<TModel> {
    await this.assertCongressExists(congressId);
    return this.delegate.create({ data: { ...data, congressId } });
  }

  async update(id: string, data: object): Promise<TModel> {
    const existing = await this.findOrThrow(id);
    await this.cleanupReplacedImage(existing, data as Record<string, unknown>);
    return this.delegate.update({ where: { id }, data });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findOrThrow(id);
    if (this.imageField) {
      await this.uploads.deleteFile(
        existing[this.imageField] as unknown as string | null,
      );
    }
    await this.delegate.delete({ where: { id } });
  }

  async reorder(ids: string[]): Promise<void> {
    // $transaction(array) formu: Prisma bu promise'leri (ayni PrismaService
    // ornegine ait olduklari icin) tek bir veritabani transaction'ina
    // gruplar - biri basarisiz olursa hicbiri uygulanmaz.
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.delegate.update({ where: { id }, data: { displayOrder: index } }),
      ),
    );
  }

  private async cleanupReplacedImage(
    existing: TModel,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!this.imageField || !(this.imageField in data)) return;

    const oldUrl = existing[this.imageField] as unknown as string | null;
    const newUrl = data[this.imageField as string] as string | null | undefined;
    if (oldUrl && oldUrl !== newUrl) {
      await this.uploads.deleteFile(oldUrl);
    }
  }
}
