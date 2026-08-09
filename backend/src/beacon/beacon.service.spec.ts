import { BadRequestException, ConflictException } from '@nestjs/common';
import { BeaconService } from './beacon.service';
import { CongressService } from '../congress/congress.service';
import { Prisma } from '../../generated/prisma/client';

// Faz 6.2: BeaconService.create()/update() artik kongrenin beaconUuid'i ile
// tutarliligi zorunlu kiliyor (bkz. docs/decisions.md "Beacon Standardi" -
// "ayni kongredeki tum beacon cihazlari ortak UUID kullanir", ki kural
// oncesinde HICBIR yerde uygulanmiyordu). Ayni fake-Prisma + `new
// ServiceClass(...)` deseni congress.service.spec.ts'te kullaniliyor.
function createFakePrisma(
  congress: { id: string; beaconUuid: string },
  existingBeacon?: Record<string, unknown>,
) {
  let currentCongress = { ...congress };
  const beacon = {
    findUnique: jest.fn().mockResolvedValue(existingBeacon ?? null),
    create: jest
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'beacon-1', ...data }),
      ),
    update: jest
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...existingBeacon, ...data }),
      ),
  };
  const congressModel = {
    findUnique: jest
      .fn()
      .mockImplementation(() => Promise.resolve(currentCongress)),
    update: jest
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        currentCongress = { ...currentCongress, ...data };
        return Promise.resolve(currentCongress);
      }),
  };
  const tx = { congress: congressModel, beacon };
  const prisma = {
    congress: congressModel,
    beacon,
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  };
  return { prisma, beacon, congressModel };
}

function buildService(
  congress: { id: string; beaconUuid: string },
  existingBeacon?: Record<string, unknown>,
) {
  const { prisma, beacon, congressModel } = createFakePrisma(
    congress,
    existingBeacon,
  );
  const congressService = new CongressService(
    prisma as never,
    {
      deleteFile: jest.fn(),
    } as never,
  );
  const service = new BeaconService(prisma as never, congressService);
  return { service, beacon, congressModel };
}

describe('BeaconService.create() - kongre UUID tutarliligi', () => {
  it('kongrenin beaconUuid ile AYNI (buyuk/kucuk harf farkli) UUID kabul edilir, BUYUK harfe normalize edilir', async () => {
    const { service } = buildService({
      id: 'congress-1',
      beaconUuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
    });

    const result = await service.create({
      congressId: 'congress-1',
      uuid: 'e2c56db5-dffb-48d2-b060-d0f5a71096e0',
      major: 1,
      minor: 1,
    });

    expect(result.uuid).toBe('E2C56DB5-DFFB-48D2-B060-D0F5A71096E0');
  });

  it('kongrenin beaconUuid ile FARKLI bir UUID icin 400 verir, beacon OLUSTURULMAZ', async () => {
    const { service, beacon } = buildService({
      id: 'congress-1',
      beaconUuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
    });

    await expect(
      service.create({
        congressId: 'congress-1',
        uuid: '11111111-1111-1111-1111-111111111111',
        major: 1,
        minor: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(beacon.create).not.toHaveBeenCalled();
  });

  it('kongrenin beaconUuid BOS ise ilk beacon icin kongreye UUID benimsenir', async () => {
    const { service, beacon, congressModel } = buildService({
      id: 'congress-1',
      beaconUuid: '',
    });

    const result = await service.create({
      congressId: 'congress-1',
      uuid: 'e2c56db5-dffb-48d2-b060-d0f5a71096e0',
      major: 1,
      minor: 1,
    });

    expect(congressModel.update).toHaveBeenCalledWith({
      where: { id: 'congress-1' },
      data: { beaconUuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0' },
    });
    expect(beacon.create).toHaveBeenCalled();
    expect(result).toMatchObject({ congressBeaconUuidAutoSet: true });
  });

  it('P2002 (ayni uuid/major/minor) durumunda 409 verir', async () => {
    const { service, beacon } = buildService({
      id: 'congress-1',
      beaconUuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
    });
    beacon.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.8.0',
      }),
    );

    await expect(
      service.create({
        congressId: 'congress-1',
        uuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
        major: 1,
        minor: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('BeaconService.update() - kongre UUID tutarliligi', () => {
  const existingBeacon = {
    id: 'beacon-1',
    congressId: 'congress-1',
    uuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
    major: 1,
    minor: 1,
    label: 'eski',
  };

  it('uuid gonderilmezse (yalnizca label degisiyor) kongreyle karsilastirma YAPILMAZ', async () => {
    const { service, beacon } = buildService(
      { id: 'congress-1', beaconUuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0' },
      existingBeacon,
    );

    await expect(
      service.update('beacon-1', { label: 'yeni' }),
    ).resolves.toBeDefined();
    expect(beacon.update).toHaveBeenCalledWith({
      where: { id: 'beacon-1' },
      data: { label: 'yeni', uuid: undefined },
    });
  });

  it('uuid kongreninkiyle FARKLI gonderilirse 400 verir', async () => {
    const { service, beacon } = buildService(
      { id: 'congress-1', beaconUuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0' },
      existingBeacon,
    );

    await expect(
      service.update('beacon-1', {
        uuid: '11111111-1111-1111-1111-111111111111',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(beacon.update).not.toHaveBeenCalled();
  });

  it('uuid kongreninkiyle AYNI (farkli case) gonderilirse kabul edilir', async () => {
    const { service, beacon } = buildService(
      { id: 'congress-1', beaconUuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0' },
      existingBeacon,
    );

    await expect(
      service.update('beacon-1', {
        uuid: 'e2c56db5-dffb-48d2-b060-d0f5a71096e0',
      }),
    ).resolves.toBeDefined();
    expect(beacon.update).toHaveBeenCalledWith({
      where: { id: 'beacon-1' },
      data: { uuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0' },
    });
  });
});
