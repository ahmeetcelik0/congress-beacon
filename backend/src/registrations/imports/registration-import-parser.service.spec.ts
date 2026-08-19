import { RegistrationImportParserService } from './registration-import-parser.service';

type FakeUser = { id: string; email: string | null; phone: string | null };

function createFakePrisma(users: FakeUser[]) {
  const findManyCalls: unknown[] = [];
  return {
    prisma: {
      user: {
        findMany: ({ where }: { where: { OR: Record<string, unknown>[] } }) => {
          findManyCalls.push(where);
          const emailIn = where.OR.find((c) => 'email' in c) as
            { email: { in: string[] } } | undefined;
          const phoneIn = where.OR.find((c) => 'phone' in c) as
            { phone: { in: string[] } } | undefined;
          const matched = users.filter(
            (u) =>
              (emailIn && u.email && emailIn.email.in.includes(u.email)) ||
              (phoneIn && u.phone && phoneIn.phone.in.includes(u.phone)),
          );
          return Promise.resolve(matched);
        },
      },
    },
    findManyCalls,
  };
}

function csv(rows: string[]): Buffer {
  return Buffer.from(rows.join('\n'), 'utf8');
}

function buildService(users: FakeUser[] = []) {
  const { prisma } = createFakePrisma(users);
  return new RegistrationImportParserService(prisma as never);
}

describe('RegistrationImportParserService', () => {
  it('temiz yeni satiri NEW olarak isler, kolonlari dogru esler', async () => {
    const service = buildService();
    const buffer = csv([
      'Ad,Soyad,E-posta,Telefon',
      'Ali,Yilmaz,ali@example.com,0532 123 45 67',
    ]);

    const result = await service.parse(buffer);

    expect(result.recognizedColumns).toEqual([
      'Ad',
      'Soyad',
      'E-posta',
      'Telefon',
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      rowNumber: 2,
      status: 'NEW',
      normalizedEmail: 'ali@example.com',
      normalizedPhone: '+905321234567',
      matchedUserId: null,
    });
  });

  it('ayni dosyada tekrar eden e-postali ikinci satir DUPLICATE olur', async () => {
    const service = buildService();
    const buffer = csv([
      'Ad,Soyad,E-posta',
      'Ali,Yilmaz,ali@example.com',
      'Ali,Yilmaz2,ali@example.com',
    ]);

    const result = await service.parse(buffer);

    expect(result.rows[0].status).toBe('NEW');
    expect(result.rows[1].status).toBe('DUPLICATE');
  });

  it('mevcut kullaniciyla eslesen satir MATCHED olur, matchedUserId doner', async () => {
    const service = buildService([
      { id: 'user-1', email: 'ali@example.com', phone: null },
    ]);
    const buffer = csv(['Ad,Soyad,E-posta', 'Ali,Yilmaz,ali@example.com']);

    const result = await service.parse(buffer);

    expect(result.rows[0].status).toBe('MATCHED');
    expect(result.rows[0].matchedUserId).toBe('user-1');
  });

  it('telefonla eslesme de calisir (e-posta yoksa)', async () => {
    const service = buildService([
      { id: 'user-2', email: null, phone: '+905321234567' },
    ]);
    const buffer = csv(['Ad,Soyad,Telefon', 'Ali,Yilmaz,0532 123 45 67']);

    const result = await service.parse(buffer);

    expect(result.rows[0].status).toBe('MATCHED');
    expect(result.rows[0].matchedUserId).toBe('user-2');
  });

  it('INVALID satir DB eslestirmesine hic girmez', async () => {
    const service = buildService();
    // Ad ve soyad bos ama ucuncu (tanimayan) kolon dolu - satir SheetJS
    // tarafindan "tamamen bos" sayilip atlanmasin diye.
    const buffer = csv(['Ad,Soyad,Not', ',,bir not']);

    const result = await service.parse(buffer);

    expect(result.rows[0].status).toBe('INVALID');
    expect(result.rows[0].matchedUserId).toBeNull();
  });

  it('tanimayan kolonlar unrecognizedColumns icinde raporlanir', async () => {
    const service = buildService();
    const buffer = csv(['Ad,Soyad,Şehir', 'Ali,Yilmaz,İstanbul']);

    const result = await service.parse(buffer);

    expect(result.unrecognizedColumns).toEqual(['Şehir']);
  });
});
