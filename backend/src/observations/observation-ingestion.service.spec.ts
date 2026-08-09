import { ForbiddenException } from '@nestjs/common';
import { ObservationIngestionService } from './observation-ingestion.service';
import type { AuthenticatedUser } from '../auth/authenticated-request';
import type { ObservationBatchDto } from './dto/observation-batch.dto';

// Faz 6.2: gelen gozlemin uuid'si buyuk harfe normalize edilerek Beacon'a
// eslestiriliyor (bkz. observation-ingestion.service.ts) - istemciden farkli
// case'te gelen bir UUID'nin (CoreLocation/CoreBluetooth farkli
// dondurebilir) MySQL collation'ina (utf8mb4_unicode_ci, zaten
// case-insensitive) guvenmeden de dogru eslesmesini garanti eder. Ayrica
// Faz 6.1'de sahada yakalanan cihaz-sahiplik 403'unu de burada kilitliyoruz.
function createFakePrisma(options: {
  device: { id: string; userId: string } | null;
  beaconId: string | null;
}) {
  const beaconObservation = {
    findFirst: jest.fn().mockResolvedValue(null),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const beacon = {
    // Sadece BUYUK harfli uuid ile eslesir - normalizasyon dogru
    // calismiyorsa (ör. istemciden kucuk harf geldiginde .toUpperCase()
    // uygulanmadan sorgulanirsa) beacon HIC bulunamaz, test bunu SONUCTAN
    // (resolvedBeacons[].beaconId) dogrular; mock cagri argumanlarini
    // sonradan incelemek yerine (bkz. Faz 6.2 - daha az kirilgan, "unsafe
    // any" lint uyarisi da gerektirmiyor).
    findUnique: jest
      .fn()
      .mockImplementation(
        ({
          where,
        }: {
          where: { congressId_uuid_major_minor: { uuid: string } };
        }) => {
          const isUppercase =
            where.congressId_uuid_major_minor.uuid ===
            where.congressId_uuid_major_minor.uuid.toUpperCase();
          return Promise.resolve(
            options.beaconId && isUppercase ? { id: options.beaconId } : null,
          );
        },
      ),
  };
  return {
    device: { findUnique: jest.fn().mockResolvedValue(options.device) },
    observationBatch: {
      create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      update: jest.fn().mockResolvedValue({ id: 'batch-1' }),
    },
    beaconObservation,
    beacon,
    congress: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ observationIntervalSeconds: 10 }),
    },
  };
}

function buildUser(overrides: Partial<AuthenticatedUser> = {}) {
  return {
    id: 'user-1',
    congressId: 'congress-1',
    ...overrides,
  } as AuthenticatedUser;
}

function buildBatchDto(uuid: string): ObservationBatchDto {
  return {
    clientBatchId: 'batch-client-1',
    deviceId: 'device-1',
    observations: [
      {
        observationId: 'obs-1',
        observedAt: new Date().toISOString(),
        beacons: [{ uuid, major: 1, minor: 1, rssi: -60 }],
      },
    ],
  };
}

describe('ObservationIngestionService.ingest() - cihaz sahipligi', () => {
  it('deviceId hic yoksa (ör. DB sifirlanmis) 403 verir - Faz 6.1de sahada yakalanan senaryo', async () => {
    const prisma = createFakePrisma({ device: null, beaconId: 'beacon-1' });
    const service = new ObservationIngestionService(prisma as never);

    await expect(
      service.ingest(
        buildUser(),
        buildBatchDto('E2C56DB5-DFFB-48D2-B060-D0F5A71096E0'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cihaz BASKA bir kullaniciya aitse 403 verir', async () => {
    const prisma = createFakePrisma({
      device: { id: 'device-1', userId: 'baska-kullanici' },
      beaconId: 'beacon-1',
    });
    const service = new ObservationIngestionService(prisma as never);

    await expect(
      service.ingest(
        buildUser(),
        buildBatchDto('E2C56DB5-DFFB-48D2-B060-D0F5A71096E0'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ObservationIngestionService.ingest() - uuid buyuk/kucuk harf normalizasyonu', () => {
  it('kucuk harfle gelen uuid Beacon eslestirmesinde BUYUK harfe cevrilir', async () => {
    const prisma = createFakePrisma({
      device: { id: 'device-1', userId: 'user-1' },
      beaconId: 'beacon-1',
    });
    const service = new ObservationIngestionService(prisma as never);

    // Sahte beacon.findUnique yalnizca BUYUK harfli sorguda eslesir (bkz.
    // createFakePrisma) - eslesmesi, normalizasyonun gercekten uygulandigini
    // SONUCTAN kanitlar.
    const result = await service.ingest(
      buildUser(),
      buildBatchDto('e2c56db5-dffb-48d2-b060-d0f5a71096e0'),
    );

    expect(result.acceptedSnapshots[0].readings[0].beaconId).toBe('beacon-1');
  });

  it('beacon eslesmezse (beaconId: null) gozlem yine de KAYDEDILIR - salon karari sonra verilir', async () => {
    const prisma = createFakePrisma({
      device: { id: 'device-1', userId: 'user-1' },
      beaconId: null,
    });
    const service = new ObservationIngestionService(prisma as never);

    const result = await service.ingest(
      buildUser(),
      buildBatchDto('11111111-1111-1111-1111-111111111111'),
    );

    expect(result.acceptedCount).toBe(1);
    expect(result.acceptedSnapshots[0].readings[0].beaconId).toBeNull();
  });
});
