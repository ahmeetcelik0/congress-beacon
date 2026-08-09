import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CreateCongressDto } from './dto/create-congress.dto';
import { UpdateCongressDto } from './dto/update-congress.dto';
import { CongressService } from './congress.service';
import { Prisma } from '../../generated/prisma/client';

// NestJS'in global `ValidationPipe`'i (bkz. main.ts: whitelist+transform)
// gercekte tam olarak bu ikiliyi (plainToInstance + validate) kullanir - bu
// yuzden DTO seviyesindeki tarih kuralini (`IsDateOnOrAfterField`) gercekci
// sekilde test etmenin dogru yolu budur, servis metodunu dogrudan cagirmak
// DEGIL (create() zaten kendi ek kontrolu yapmiyor, DTO'ya guveniyor).
function validCreateBody(overrides: Partial<CreateCongressDto> = {}) {
  return {
    name: 'Test Kongresi',
    code: `TEST-${Math.random().toString(36).slice(2)}`,
    accessCode: 'pilot1234',
    beaconUuid: '3537dc2a-6e96-4a03-bf6d-37447d11a1dd',
    ...overrides,
  };
}

async function validateCreate(overrides: Partial<CreateCongressDto> = {}) {
  const dto = plainToInstance(CreateCongressDto, validCreateBody(overrides));
  return validate(dto);
}

async function validateUpdate(body: Partial<UpdateCongressDto>) {
  const dto = plainToInstance(UpdateCongressDto, body);
  return validate(dto);
}

describe('Kongre tarih dogrulamasi - CreateCongressDto', () => {
  it('startDate < endDate icin basarili (hata yok)', async () => {
    const errors = await validateCreate({
      startDate: '2026-08-01',
      endDate: '2026-08-05',
    });
    expect(errors).toHaveLength(0);
  });

  it('startDate === endDate (tek gunluk kongre) icin basarili (esitlik serbest)', async () => {
    const errors = await validateCreate({
      startDate: '2026-08-01',
      endDate: '2026-08-01',
    });
    expect(errors).toHaveLength(0);
  });

  it('startDate > endDate icin dogrulama hatasi verir', async () => {
    const errors = await validateCreate({
      startDate: '2026-08-05',
      endDate: '2026-08-01',
    });
    const endDateError = errors.find((error) => error.property === 'endDate');
    expect(endDateError).toBeDefined();
    expect(endDateError?.constraints).toHaveProperty('isDateOnOrAfterField');
  });

  it('yalnizca startDate gonderilirse (endDate yok) dogrulama tetiklenmez', async () => {
    const errors = await validateCreate({ startDate: '2026-08-05' });
    expect(errors).toHaveLength(0);
  });

  it('yalnizca endDate gonderilirse (startDate yok) dogrulama tetiklenmez', async () => {
    const errors = await validateCreate({ endDate: '2026-08-01' });
    expect(errors).toHaveLength(0);
  });
});

describe('Kongre tarih dogrulamasi - UpdateCongressDto (iki alan birlikte)', () => {
  it('iki tarih birlikte + gecerli (start < end) icin basarili', async () => {
    const errors = await validateUpdate({
      startDate: '2026-08-01',
      endDate: '2026-08-05',
    });
    expect(errors).toHaveLength(0);
  });

  it('iki tarih birlikte + ters (start > end) icin dogrulama hatasi verir', async () => {
    const errors = await validateUpdate({
      startDate: '2026-08-05',
      endDate: '2026-08-01',
    });
    const endDateError = errors.find((error) => error.property === 'endDate');
    expect(endDateError).toBeDefined();
    expect(endDateError?.constraints).toHaveProperty('isDateOnOrAfterField');
  });

  it('tek gunluk (start === end) icin basarili', async () => {
    const errors = await validateUpdate({
      startDate: '2026-08-01',
      endDate: '2026-08-01',
    });
    expect(errors).toHaveLength(0);
  });
});

// Kismi PATCH'te DTO tek basina yeterli degil (bkz. congress.service.ts
// yorumu) - servis seviyesindeki (kayitli + gelen) birlesik kontrolu
// dogrudan CongressService.update() cagirarak, hafif bir sahte
// PrismaService ile test ediyoruz (ayni desen:
// attendance-processing.service.spec.ts'teki fonksiyonel sahte nesne).
function createFakePrismaForUpdate(
  current: {
    startDate: Date | null;
    endDate: Date | null;
    entryProbabilityThreshold: number;
    exitProbabilityThreshold: number;
    beaconUuid?: string;
  },
  beaconCount = 0,
) {
  const congressModel = {
    findUnique: jest.fn().mockResolvedValue({ id: 'congress-1', ...current }),
    update: jest.fn().mockImplementation(({ data }: { data: unknown }) =>
      Promise.resolve({
        id: 'congress-1',
        ...current,
        ...(data as object),
      }),
    ),
    delete: jest.fn(),
  };
  const beaconModel = {
    count: jest.fn().mockResolvedValue(beaconCount),
    updateMany: jest.fn().mockResolvedValue({ count: beaconCount }),
  };
  const tx = { congress: congressModel, beacon: beaconModel };
  return {
    congress: congressModel,
    beacon: beaconModel,
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  };
}

const baseCurrentForCover = {
  startDate: new Date('2026-08-01T00:00:00.000Z'),
  endDate: new Date('2026-08-10T00:00:00.000Z'),
  entryProbabilityThreshold: 60,
  exitProbabilityThreshold: 40,
};

describe('CongressService.update() - kismi PATCH birlesik tarih kontrolu', () => {
  const baseCurrent = {
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    endDate: new Date('2026-08-10T00:00:00.000Z'),
    entryProbabilityThreshold: 60,
    exitProbabilityThreshold: 40,
  };

  it("yalnizca startDate guncelleniyor ve mevcut endDate'ten SONRA kaliyorsa 400 verir", async () => {
    const fakePrisma = createFakePrismaForUpdate(baseCurrent);
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile: jest.fn() } as never,
    );

    await expect(
      service.update('congress-1', {
        startDate: '2026-08-15',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("yalnizca endDate guncelleniyor ve mevcut startDate'ten ONCE kaliyorsa 400 verir", async () => {
    const fakePrisma = createFakePrismaForUpdate(baseCurrent);
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile: jest.fn() } as never,
    );

    await expect(
      service.update('congress-1', {
        endDate: '2026-07-20',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('yalnizca startDate guncelleniyor ve mevcut endDate ile tutarliysa basarili', async () => {
    const fakePrisma = createFakePrismaForUpdate(baseCurrent);
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile: jest.fn() } as never,
    );

    await expect(
      service.update('congress-1', {
        startDate: '2026-08-05',
      }),
    ).resolves.toBeDefined();
  });

  it('tek gunluk PATCH (startDate === endDate) basarili', async () => {
    const fakePrisma = createFakePrismaForUpdate(baseCurrent);
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile: jest.fn() } as never,
    );

    await expect(
      service.update('congress-1', {
        startDate: '2026-08-03',
        endDate: '2026-08-03',
      }),
    ).resolves.toBeDefined();
  });
});

describe('CongressService.update() - kapak gorseli degistirilince eski dosya silinir', () => {
  it('coverImageUrl DEGISTIRILINCE eski dosyayi UploadsService.deleteFile ile siler', async () => {
    const fakePrisma = createFakePrismaForUpdate({
      ...baseCurrentForCover,
      coverImageUrl: '/uploads/congress-1/old.jpg',
    } as never);
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile } as never,
    );

    await service.update('congress-1', {
      coverImageUrl: '/uploads/congress-1/new.jpg',
    });

    expect(deleteFile).toHaveBeenCalledWith('/uploads/congress-1/old.jpg');
  });

  it('coverImageUrl DISINDA bir alan guncellenince eski gorsele DOKUNMAZ', async () => {
    const fakePrisma = createFakePrismaForUpdate({
      ...baseCurrentForCover,
      coverImageUrl: '/uploads/congress-1/old.jpg',
    } as never);
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile } as never,
    );

    await service.update('congress-1', { description: 'Yeni aciklama' });

    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('mevcut kapak gorseli yoksa (ilk yukleme) deleteFile cagrilmaz', async () => {
    const fakePrisma = createFakePrismaForUpdate({
      ...baseCurrentForCover,
      coverImageUrl: null,
    } as never);
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile } as never,
    );

    await service.update('congress-1', {
      coverImageUrl: '/uploads/congress-1/first.jpg',
    });

    expect(deleteFile).not.toHaveBeenCalled();
  });
});

// Faz 6.2: beaconUuid degistirilirken, kongrede zaten beacon varsa sessizce
// yarim kalan bir durum (bazi beacon'lar eski/bazilari yeni UUID'de)
// olusmasin diye acik onay zorunlu kilindi (bkz. docs/decisions.md).
describe('CongressService.update() - beaconUuid degisikligi ve migrateExistingBeacons', () => {
  const baseCurrentWithUuid = {
    startDate: null,
    endDate: null,
    entryProbabilityThreshold: 60,
    exitProbabilityThreshold: 40,
    beaconUuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
  };

  it('beaconUuid AYNI (farkli case) gonderilirse degisiklik sayilmaz, beacon.count cagrilmaz', async () => {
    const fakePrisma = createFakePrismaForUpdate(baseCurrentWithUuid, 3);
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile: jest.fn() } as never,
    );

    await service.update('congress-1', {
      beaconUuid: 'e2c56db5-dffb-48d2-b060-d0f5a71096e0',
    });

    expect(fakePrisma.beacon.count).not.toHaveBeenCalled();
  });

  it('beaconUuid degisiyor VE kongrede beacon YOKSA onaysiz da basarili olur', async () => {
    const fakePrisma = createFakePrismaForUpdate(baseCurrentWithUuid, 0);
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile: jest.fn() } as never,
    );

    const result = await service.update('congress-1', {
      beaconUuid: '11111111-1111-1111-1111-111111111111',
    });

    expect(result).toMatchObject({
      beaconUuid: '11111111-1111-1111-1111-111111111111',
    });
    expect(fakePrisma.beacon.updateMany).not.toHaveBeenCalled();
  });

  it('beaconUuid degisiyor VE kongrede beacon VARSA, onay olmadan 409 verir', async () => {
    const fakePrisma = createFakePrismaForUpdate(baseCurrentWithUuid, 5);
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile: jest.fn() } as never,
    );

    await expect(
      service.update('congress-1', {
        beaconUuid: '11111111-1111-1111-1111-111111111111',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(fakePrisma.congress.update).not.toHaveBeenCalled();
  });

  it("migrateExistingBeacons: true ile TUM beacon'lar da yeni UUID'ye guncellenir", async () => {
    const fakePrisma = createFakePrismaForUpdate(baseCurrentWithUuid, 5);
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile: jest.fn() } as never,
    );

    const result = await service.update('congress-1', {
      beaconUuid: '11111111-1111-1111-1111-111111111111',
      migrateExistingBeacons: true,
    });

    expect(fakePrisma.beacon.updateMany).toHaveBeenCalledWith({
      where: { congressId: 'congress-1' },
      data: { uuid: '11111111-1111-1111-1111-111111111111' },
    });
    // congressModel.update sahtesi `data`yi sonuca aynen yayiyor (bkz.
    // createFakePrismaForUpdate) - donen degerde dogru beaconUuid'nin
    // gorunmesi, Prisma'ya GERCEKTEN yeni deger gonderildigini kanitlar.
    expect(result).toMatchObject({
      beaconUuid: '11111111-1111-1111-1111-111111111111',
      beaconsUpdated: 5,
    });
  });

  it("'migrateExistingBeacons' alani Prisma'nin update data'sina SIZMAZ", async () => {
    const fakePrisma = createFakePrismaForUpdate(baseCurrentWithUuid, 0);
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile: jest.fn() } as never,
    );

    // congressModel.update sahtesi `data`yi sonuca aynen yayiyor - eger
    // `migrateExistingBeacons` Prisma'nin `data` nesnesine sizmis olsaydi,
    // donen sonucta da bir alan olarak gorunurdu (Prisma gercekte boyle bir
    // durumda bilinmeyen alan hatasi firlatirdi, ama bu sahte icin en
    // guvenilir/en az kirilgan dogrulama SONUCTA gorunmemesidir).
    const result = await service.update('congress-1', {
      beaconUuid: '11111111-1111-1111-1111-111111111111',
      migrateExistingBeacons: false,
    });

    expect(result).not.toHaveProperty('migrateExistingBeacons');
  });
});

describe('CongressService.remove() - Prisma FK kisitlamasi siniflandirmasi', () => {
  function createFakePrismaForRemove(deleteImpl: () => Promise<unknown>) {
    return {
      congress: {
        findUnique: jest.fn().mockResolvedValue({ id: 'congress-1' }),
        delete: jest.fn().mockImplementation(deleteImpl),
      },
    };
  }

  it('bagli verisi olmayan kongre basariyla silinir', async () => {
    const fakePrisma = createFakePrismaForRemove(() =>
      Promise.resolve({ id: 'congress-1' }),
    );
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile: jest.fn() } as never,
    );

    await expect(service.remove('congress-1')).resolves.toBeUndefined();
    expect(fakePrisma.congress.delete).toHaveBeenCalledWith({
      where: { id: 'congress-1' },
    });
  });

  it('P2003 (FK constraint) hatasinda ConflictException (409) firlatir, ham Prisma/SQL mesaji sizdirmaz', async () => {
    const fakePrisma = createFakePrismaForRemove(() =>
      Promise.reject(
        new Prisma.PrismaClientKnownRequestError(
          'Foreign key constraint failed',
          {
            code: 'P2003',
            clientVersion: '7.8.0',
            meta: { modelName: 'Congress' },
          },
        ),
      ),
    );
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile: jest.fn() } as never,
    );

    let caught: unknown;
    try {
      await service.remove('congress-1');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConflictException);
    const message = (caught as ConflictException).message;
    expect(message).not.toMatch(/prisma|sql|constraint fails|P2003/i);
    expect(message).toMatch(/kongre silinemiyor/i);
  });

  it('P2003 DISINDAKI bir Prisma hatasi mevcut genel akisa (throw) devam eder, 409a cevrilmez', async () => {
    const otherError = new Prisma.PrismaClientKnownRequestError(
      'Baska bir hata',
      {
        code: 'P2025',
        clientVersion: '7.8.0',
      },
    );
    const fakePrisma = createFakePrismaForRemove(() =>
      Promise.reject(otherError),
    );
    const service = new CongressService(
      fakePrisma as never,
      { deleteFile: jest.fn() } as never,
    );

    await expect(service.remove('congress-1')).rejects.toBe(otherError);
  });
});
