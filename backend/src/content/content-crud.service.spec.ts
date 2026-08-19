import { NotFoundException } from '@nestjs/common';
import { ContentCrudService, ContentDelegate } from './content-crud.service';

type FakeModel = {
  id: string;
  congressId: string;
  name: string;
  imageUrl: string | null;
  displayOrder: number;
};

// ContentCrudService abstract oldugu icin testte somut, minimal bir alt
// sinif kullanilir - gercek Venue/Sponsor/... servislerinin BIREBIR ayni
// deseni.
class TestContentService extends ContentCrudService<FakeModel> {
  protected readonly delegate: ContentDelegate<FakeModel>;
  protected readonly defaultOrderBy = { displayOrder: 'asc' as const };
  protected readonly imageField = 'imageUrl' as const;

  constructor(
    prisma: never,
    uploads: never,
    delegate: ContentDelegate<FakeModel>,
  ) {
    super(prisma, uploads);
    this.delegate = delegate;
  }
}

function createFakeDelegate(initial: FakeModel[]) {
  const rows = new Map(initial.map((row) => [row.id, { ...row }]));
  return {
    findMany: jest.fn(({ where }: { where: { congressId: string } }) =>
      Promise.resolve(
        [...rows.values()].filter((row) => row.congressId === where.congressId),
      ),
    ),
    findUnique: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(rows.get(where.id) ?? null),
    ),
    create: jest.fn(({ data }: { data: Partial<FakeModel> }) => {
      const row = {
        id: `row-${rows.size + 1}`,
        imageUrl: null,
        displayOrder: 0,
        ...data,
      } as FakeModel;
      rows.set(row.id, row);
      return Promise.resolve(row);
    }),
    update: jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeModel>;
      }) => {
        const row = rows.get(where.id);
        if (!row) {
          return Promise.reject(new Error('kayit yok'));
        }
        Object.assign(row, data);
        return Promise.resolve(row);
      },
    ),
    delete: jest.fn(({ where }: { where: { id: string } }) => {
      const row = rows.get(where.id);
      rows.delete(where.id);
      return Promise.resolve(row as FakeModel);
    }),
  };
}

function createFakePrisma(
  delegate: ReturnType<typeof createFakeDelegate>,
  congressIds: string[],
) {
  return {
    congress: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          congressIds.includes(where.id) ? { id: where.id } : null,
        ),
      ),
    },
    // $transaction(array) formu: testte butun promise'ler zaten Promise.resolve
    // ile cozumleniyor - basitce hepsini bekleyip sonuclari donduruyoruz.
    $transaction: (promises: Promise<unknown>[]) => Promise.all(promises),
  };
}

describe('ContentCrudService', () => {
  it('list() yalnizca ilgili congressId altindaki kayitlari doner', async () => {
    const delegate = createFakeDelegate([
      {
        id: 'v1',
        congressId: 'cong-1',
        name: 'A',
        imageUrl: null,
        displayOrder: 0,
      },
      {
        id: 'v2',
        congressId: 'cong-2',
        name: 'B',
        imageUrl: null,
        displayOrder: 0,
      },
    ]);
    const prisma = createFakePrisma(delegate, ['cong-1', 'cong-2']);
    const service = new TestContentService(
      prisma as never,
      {} as never,
      delegate,
    );

    const result = await service.list('cong-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('v1');
  });

  it('create() var olmayan kongre icin 404 doner, kayit OLUSTURULMAZ', async () => {
    const delegate = createFakeDelegate([]);
    const prisma = createFakePrisma(delegate, ['cong-1']);
    const service = new TestContentService(
      prisma as never,
      {} as never,
      delegate,
    );

    await expect(
      service.create('yok-kongre', { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(delegate.create).not.toHaveBeenCalled();
  });

  it('remove() gorseli olan bir kaydi silince UploadsService.deleteFile cagrilir', async () => {
    const delegate = createFakeDelegate([
      {
        id: 'v1',
        congressId: 'cong-1',
        name: 'A',
        imageUrl: '/uploads/cong-1/x.jpg',
        displayOrder: 0,
      },
    ]);
    const prisma = createFakePrisma(delegate, ['cong-1']);
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const service = new TestContentService(
      prisma as never,
      { deleteFile } as never,
      delegate,
    );

    await service.remove('v1');

    expect(deleteFile).toHaveBeenCalledWith('/uploads/cong-1/x.jpg');
    expect(delegate.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
  });

  it('remove() gorseli olmayan bir kaydi silince deleteFile null ile cagrilir (hata firlatmaz)', async () => {
    const delegate = createFakeDelegate([
      {
        id: 'v1',
        congressId: 'cong-1',
        name: 'A',
        imageUrl: null,
        displayOrder: 0,
      },
    ]);
    const prisma = createFakePrisma(delegate, ['cong-1']);
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const service = new TestContentService(
      prisma as never,
      { deleteFile } as never,
      delegate,
    );

    await service.remove('v1');

    expect(deleteFile).toHaveBeenCalledWith(null);
  });

  it('update() gorsel alanini DEGISTIRINCE eski dosyayi siler', async () => {
    const delegate = createFakeDelegate([
      {
        id: 'v1',
        congressId: 'cong-1',
        name: 'A',
        imageUrl: '/uploads/cong-1/old.jpg',
        displayOrder: 0,
      },
    ]);
    const prisma = createFakePrisma(delegate, ['cong-1']);
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const service = new TestContentService(
      prisma as never,
      { deleteFile } as never,
      delegate,
    );

    await service.update('v1', { imageUrl: '/uploads/cong-1/new.jpg' });

    expect(deleteFile).toHaveBeenCalledWith('/uploads/cong-1/old.jpg');
  });

  it('update() gorsel alanina HIC DOKUNMAYAN bir PATCH eski dosyayi SILMEZ', async () => {
    const delegate = createFakeDelegate([
      {
        id: 'v1',
        congressId: 'cong-1',
        name: 'A',
        imageUrl: '/uploads/cong-1/old.jpg',
        displayOrder: 0,
      },
    ]);
    const prisma = createFakePrisma(delegate, ['cong-1']);
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const service = new TestContentService(
      prisma as never,
      { deleteFile } as never,
      delegate,
    );

    await service.update('v1', { name: 'Yeni isim' });

    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('reorder() ids sirasina gore displayOrder degerlerini 0dan baslayarak yeniden yazar', async () => {
    const delegate = createFakeDelegate([
      {
        id: 'v1',
        congressId: 'cong-1',
        name: 'A',
        imageUrl: null,
        displayOrder: 5,
      },
      {
        id: 'v2',
        congressId: 'cong-1',
        name: 'B',
        imageUrl: null,
        displayOrder: 2,
      },
      {
        id: 'v3',
        congressId: 'cong-1',
        name: 'C',
        imageUrl: null,
        displayOrder: 9,
      },
    ]);
    const prisma = createFakePrisma(delegate, ['cong-1']);
    const service = new TestContentService(
      prisma as never,
      {} as never,
      delegate,
    );

    // Istenen nihai sira: v3, v1, v2
    await service.reorder(['v3', 'v1', 'v2']);

    const v3 = await delegate.findUnique({ where: { id: 'v3' } });
    const v1 = await delegate.findUnique({ where: { id: 'v1' } });
    const v2 = await delegate.findUnique({ where: { id: 'v2' } });
    expect(v3?.displayOrder).toBe(0);
    expect(v1?.displayOrder).toBe(1);
    expect(v2?.displayOrder).toBe(2);
  });
});
