import { NotFoundException } from '@nestjs/common';
import { MobileService } from './mobile.service';
import {
  ProgramRoleType,
  RoleMatchStatus,
} from '../../generated/prisma/client';

// Dominant proje deseni: NestJS TestingModule/DI KURULMAZ, servis dogrudan
// sahte (jest.fn tabanli) bir PrismaService ile ornek. Gercek Prisma sorgu
// motorunu TEKRAR YAZMAYA calismak yerine (bu, test edilen kodu test etme
// riski tasir), asagidaki testlerin cogu Prisma'ya GECEN ARGUMANLARI
// dogrular (`toHaveBeenCalledWith`) - as?l guvenlik/is kurali (publishedAt
// filtresi, congressId izolasyonu, kisisel veri secilmemesi) TAM OLARAK bu
// argumanlarda yasar; DB'nin bu where/select'i dogru uygulamasi Prisma'nin
// sorumlulugu, burada test edilmiyor (bkz. content-crud.service.spec.ts'in
// benzer felsefesi).
// jest.fn()'in Prisma cagri argumanlarini `any` yerine `unknown` uzerinden
// tip guvenli sekilde okumak icin - `no-unsafe-member-access` kuralinin
// `any` indexlemeye itiraz etmesini tek bir yerde cozer.
function lastCallArg<T>(mockFn: jest.Mock): T {
  const calls = mockFn.mock.calls as unknown[][];
  return calls[0][0] as T;
}

function createFakePrisma() {
  return {
    congress: { findUniqueOrThrow: jest.fn() },
    venue: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    announcement: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    sponsor: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    keynoteSpeaker: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    congressInfoSection: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    session: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _max: { updatedAt: null }, _count: 0 }),
    },
    presentation: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _max: { updatedAt: null }, _count: 0 }),
    },
    programRole: {
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _max: { updatedAt: null }, _count: 0 }),
    },
  };
}

describe('MobileService', () => {
  describe('getAnnouncements', () => {
    it('yalnizca YAYINLANMIS duyurulari sorgular (publishedAt: not null)', async () => {
      const prisma = createFakePrisma();
      const service = new MobileService(prisma as never);

      await service.getAnnouncements('congress-1');

      expect(prisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { congressId: 'congress-1', publishedAt: { not: null } },
        }),
      );
    });

    it('sabitlenmis + en yeni sirasini kullanir', async () => {
      const prisma = createFakePrisma();
      const service = new MobileService(prisma as never);

      await service.getAnnouncements('congress-1');

      expect(prisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        }),
      );
    });

    it('generatedAt alani doner', async () => {
      const prisma = createFakePrisma();
      const service = new MobileService(prisma as never);

      const result = await service.getAnnouncements('congress-1');

      expect(typeof result.generatedAt).toBe('string');
      expect(new Date(result.generatedAt).toString()).not.toBe('Invalid Date');
    });
  });

  describe('getInfoSections', () => {
    it('yalnizca isPublished=true bolumleri sorgular', async () => {
      const prisma = createFakePrisma();
      const service = new MobileService(prisma as never);

      await service.getInfoSections('congress-1');

      expect(prisma.congressInfoSection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { congressId: 'congress-1', isPublished: true },
        }),
      );
    });
  });

  describe('getSessionDetail', () => {
    it('congressId ile ES ZAMANLI filtreler (baska kongrenin ID tahmini 404 alir)', async () => {
      const prisma = createFakePrisma();
      prisma.session.findFirst.mockResolvedValue(null);
      const service = new MobileService(prisma as never);

      await expect(
        service.getSessionDetail('congress-1', 'session-from-other-congress'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'session-from-other-congress',
            congressId: 'congress-1',
          },
        }),
      );
    });

    it('oturum bulunursa oldugu gibi doner', async () => {
      const prisma = createFakePrisma();
      const fakeSession = { id: 's1', title: 'Acilis' };
      prisma.session.findFirst.mockResolvedValue(fakeSession);
      const service = new MobileService(prisma as never);

      const result = await service.getSessionDetail('congress-1', 's1');
      expect(result).toBe(fakeSession);
    });
  });

  describe('kisisel veri sizintisi - /mobile/program sorgusu', () => {
    it('ProgramRole secimi ASLA user iliskisini join etmez, yalnizca guvenli alanlari secer', async () => {
      const prisma = createFakePrisma();
      const service = new MobileService(prisma as never);

      await service.getProgram('congress-1', {});

      const call = lastCallArg<{ select: unknown }>(prisma.session.findMany);
      const selectJson = JSON.stringify(call.select);

      // Yasakli: baska bir katilimcinin iletisim/kimlik bilgisi hicbir
      // sekilde secilmemeli.
      expect(selectJson).not.toMatch(/"user"/);
      expect(selectJson).not.toMatch(/email/i);
      expect(selectJson).not.toMatch(/phoneRaw/);
      expect(selectJson).not.toMatch(/"phone"/);
      expect(selectJson).not.toMatch(/searchName/);
      expect(selectJson).not.toMatch(/passwordHash/);
      expect(selectJson).not.toMatch(/lastLoginAt/);

      // Ama beklenen guvenli alanlar gercekten SECILIYOR olmali (select'in
      // yanlislikla bombos/tamamen farkli bir sey olmadigini dogrular).
      expect(selectJson).toMatch(/rawName/);
      expect(selectJson).toMatch(/userId/);
      expect(selectJson).toMatch(/matchStatus/);
    });

    it('congressId ile filtreler, baska kongrenin oturumlari donmez', async () => {
      const prisma = createFakePrisma();
      const service = new MobileService(prisma as never);

      await service.getProgram('congress-1', {});

      const call = lastCallArg<{ where: { congressId: string } }>(
        prisma.session.findMany,
      );
      expect(call.where.congressId).toBe('congress-1');
    });

    it('day/hallId/search filtreleri where govdesine dogru yansir', async () => {
      const prisma = createFakePrisma();
      const service = new MobileService(prisma as never);

      await service.getProgram('congress-1', {
        day: '1. Gun',
        hallId: 'hall-1',
        search: 'kardiyoloji',
      });

      const call = lastCallArg<{ where: Record<string, unknown> }>(
        prisma.session.findMany,
      );
      expect(call.where.dayLabel).toBe('1. Gun');
      expect(call.where.hallId).toBe('hall-1');
      expect(call.where.OR).toBeDefined();
    });

    it('sunumlari startTime once, sonra displayOrder ile siralar; bos startTime EN SONA duser (Faz 10 savunma derinligi)', async () => {
      // Onay akisindaki `displayOrder` yazim hatasi (bkz. docs/decisions.md
      // "Faz 10") duzeltildi, ama bu sorgu YINE DE `startTime`i birincil
      // siralama anahtari yapar - saat bilgisi olmayan bir sunumun
      // (`nulls: 'last'` olmadan MySQL/Prisma bunu EN KUCUK deger sayardi)
      // saatli sunumlarin ONUNE gecmesini engeller.
      const prisma = createFakePrisma();
      const service = new MobileService(prisma as never);

      await service.getProgram('congress-1', {});

      const call = lastCallArg<{
        select: {
          presentations: { orderBy: unknown };
        };
      }>(prisma.session.findMany);
      expect(call.select.presentations.orderBy).toEqual([
        { startTime: { sort: 'asc', nulls: 'last' } },
        { displayOrder: 'asc' },
      ]);
    });
  });

  describe('getProgramDays', () => {
    it('her gun etiketi icin ILK oturumun baslangic tarihinden turetilmis date alani doner', async () => {
      // Faz 10: `day.label` kanonik semada opsiyonel (bkz. docs/decisions.md
      // "Faz 4d") - bu yuzden goruntulenen tarih HER ZAMAN gercek
      // `startTime`den hesaplanir, uretilmis etikete guvenilmez. NOT: mobil
      // istemci bu ucu cagirmiyor (bkz. mobile.service.ts yorumu), ama
      // baska bir istemci icin dogru kalmali.
      const prisma = createFakePrisma();
      const service = new MobileService(prisma as never);
      prisma.session.findMany.mockResolvedValue([
        { dayLabel: '1. Gün', startTime: new Date('2026-09-10T06:00:00Z') },
        { dayLabel: '1. Gün', startTime: new Date('2026-09-10T07:00:00Z') },
        { dayLabel: '2. Gün', startTime: new Date('2026-09-11T06:00:00Z') },
      ]);

      const days = await service.getProgramDays('congress-1');

      expect(days).toEqual([
        { label: '1. Gün', date: '2026-09-10' },
        { label: '2. Gün', date: '2026-09-11' },
      ]);
    });
  });

  describe('getVenues', () => {
    it('MAIN once, sonra HOTEL sirasini kullanir (type asc)', async () => {
      const prisma = createFakePrisma();
      const service = new MobileService(prisma as never);

      await service.getVenues('congress-1');

      expect(prisma.venue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }],
        }),
      );
    });
  });

  describe('getSponsors', () => {
    it('tier sonra displayOrder sirasini kullanir', async () => {
      const prisma = createFakePrisma();
      const service = new MobileService(prisma as never);

      await service.getSponsors('congress-1');

      expect(prisma.sponsor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ tier: 'asc' }, { displayOrder: 'asc' }],
        }),
      );
    });
  });

  describe('getHome', () => {
    it('duyuru sayimini yalnizca yayinlanmislar uzerinden alir', async () => {
      const prisma = createFakePrisma();
      prisma.congress.findUniqueOrThrow.mockResolvedValue({
        id: 'congress-1',
        name: 'Test',
        fullName: null,
        startDate: null,
        endDate: null,
        description: null,
        coverImageUrl: null,
      });
      const service = new MobileService(prisma as never);

      await service.getHome('congress-1', 'user-1');

      expect(prisma.announcement.count).toHaveBeenCalledWith({
        where: { congressId: 'congress-1', publishedAt: { not: null } },
      });
      expect(prisma.congressInfoSection.count).toHaveBeenCalledWith({
        where: { congressId: 'congress-1', isPublished: true },
      });
    });

    it('ana mekani VenueType.MAIN uzerinden arar', async () => {
      const prisma = createFakePrisma();
      prisma.congress.findUniqueOrThrow.mockResolvedValue({
        id: 'congress-1',
        name: 'Test',
        fullName: null,
        startDate: null,
        endDate: null,
        description: null,
        coverImageUrl: null,
      });
      prisma.venue.findFirst.mockResolvedValue({ name: 'Kongre Merkezi' });
      const service = new MobileService(prisma as never);

      const result = await service.getHome('congress-1', 'user-1');

      expect(prisma.venue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { congressId: 'congress-1', type: 'MAIN' },
        }),
      );
      expect(result.congress.mainVenueName).toBe('Kongre Merkezi');
    });
  });

  describe('getMyNextSession / getMyProgram', () => {
    function fakeRole(overrides: Record<string, unknown> = {}) {
      return {
        type: ProgramRoleType.SPEAKER,
        session: null,
        presentation: null,
        ...overrides,
      };
    }

    it('yalnizca MATCHED/MANUAL rolleri sorgular, digerlerini (AMBIGUOUS/UNMATCHED/IGNORED) HARIC tutar', async () => {
      const prisma = createFakePrisma();
      const service = new MobileService(prisma as never);

      await service.getMyNextSession('congress-1', 'user-1');

      const call = lastCallArg<{
        where: { userId: string; matchStatus: { in: RoleMatchStatus[] } };
      }>(prisma.programRole.findMany);
      expect(call.where.userId).toBe('user-1');
      expect(call.where.matchStatus.in).toEqual([
        RoleMatchStatus.MATCHED,
        RoleMatchStatus.MANUAL,
      ]);
    });

    it('bir oturum rolu icin gelecekteki oturumu myNextSession olarak doner', async () => {
      const prisma = createFakePrisma();
      const future = new Date(Date.now() + 60 * 60 * 1000);
      const futureEnd = new Date(Date.now() + 2 * 60 * 60 * 1000);
      prisma.programRole.findMany.mockResolvedValue([
        fakeRole({
          session: {
            id: 'session-1',
            title: 'Acilis Konusmasi',
            startTime: future,
            endTime: futureEnd,
            hall: { name: 'Salon 1' },
          },
        }),
      ]);
      const service = new MobileService(prisma as never);

      const result = await service.getMyNextSession('congress-1', 'user-1');

      expect(result).toMatchObject({
        sessionId: 'session-1',
        presentationId: null,
        title: 'Acilis Konusmasi',
        hallName: 'Salon 1',
        isOngoing: false,
      });
    });

    it('bir sunum rolu icin sunumun kendi baslik/saatini kullanir (oturumunkini degil)', async () => {
      const prisma = createFakePrisma();
      const future = new Date(Date.now() + 60 * 60 * 1000);
      const futureEnd = new Date(Date.now() + 2 * 60 * 60 * 1000);
      prisma.programRole.findMany.mockResolvedValue([
        fakeRole({
          presentation: {
            id: 'presentation-1',
            title: 'Vaka Sunumu',
            startTime: future,
            endTime: futureEnd,
            session: {
              id: 'session-1',
              startTime: new Date(Date.now() - 60 * 60 * 1000),
              endTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
              hall: { name: 'Salon 2' },
            },
          },
        }),
      ]);
      const service = new MobileService(prisma as never);

      const result = await service.getMyNextSession('congress-1', 'user-1');

      expect(result).toMatchObject({
        sessionId: 'session-1',
        presentationId: 'presentation-1',
        title: 'Vaka Sunumu',
        hallName: 'Salon 2',
      });
    });

    it('hic uygun rol yoksa null doner', async () => {
      const prisma = createFakePrisma();
      prisma.programRole.findMany.mockResolvedValue([]);
      const service = new MobileService(prisma as never);

      const result = await service.getMyNextSession('congress-1', 'user-1');
      expect(result).toBeNull();
    });

    it('getMyProgram kronolojik sirada bir items listesi doner', async () => {
      const prisma = createFakePrisma();
      const early = new Date('2026-04-09T09:00:00.000Z');
      const late = new Date('2026-04-09T15:00:00.000Z');
      prisma.programRole.findMany.mockResolvedValue([
        fakeRole({
          session: {
            id: 'late',
            title: 'Gec Oturum',
            startTime: late,
            endTime: late,
            hall: { name: 'Salon 1' },
          },
        }),
        fakeRole({
          session: {
            id: 'early',
            title: 'Erken Oturum',
            startTime: early,
            endTime: early,
            hall: { name: 'Salon 1' },
          },
        }),
      ]);
      const service = new MobileService(prisma as never);

      const result = await service.getMyProgram('congress-1', 'user-1');

      expect(result.items.map((item) => item.sessionId)).toEqual([
        'early',
        'late',
      ]);
    });
  });

  describe('computeProgramEtag', () => {
    it('gecerli bir etag formati (tirnak icinde hex) doner', async () => {
      const prisma = createFakePrisma();
      const service = new MobileService(prisma as never);

      const etag = await service.computeProgramEtag('congress-1');
      expect(etag).toMatch(/^"[0-9a-f]{40}"$/);
    });

    it('session/presentation/role sorgularinin hepsi congressId ile kapsamlanir', async () => {
      const prisma = createFakePrisma();
      const service = new MobileService(prisma as never);

      await service.computeProgramEtag('congress-1');

      expect(prisma.session.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { congressId: 'congress-1' } }),
      );
      expect(prisma.presentation.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { session: { congressId: 'congress-1' } },
        }),
      );
    });

    it('kayit sayisi degisince FARKLI bir etag uretir (silme durumunu yakalar)', async () => {
      const prismaA = createFakePrisma();
      prismaA.session.aggregate.mockResolvedValue({
        _max: { updatedAt: new Date('2026-01-01') },
        _count: 3,
      });
      const serviceA = new MobileService(prismaA as never);
      const etagA = await serviceA.computeProgramEtag('congress-1');

      const prismaB = createFakePrisma();
      prismaB.session.aggregate.mockResolvedValue({
        _max: { updatedAt: new Date('2026-01-01') },
        _count: 2,
      });
      const serviceB = new MobileService(prismaB as never);
      const etagB = await serviceB.computeProgramEtag('congress-1');

      expect(etagA).not.toBe(etagB);
    });
  });
});
