import { ReportsService } from './reports.service';

// Faz 6.2: getDataQuality() artik yalnizca eslesme oranini degil, "NEDEN
// eslesmiyor" sorusunun cevabini da doner - en cok gorulen eslesmeyen UUID/
// major/minor kirilimi ve kongre duzeyinde bir tutarlilik uyarisi (bkz.
// docs/decisions.md "Faz 6.2" - sahada 6+ dakika teshis edilemeyen "veri
// geliyor ama hicbir beacon'a baglanmiyor" durumunun bir sonraki sefer
// panelden dogrudan gorulur olmasi hedefi).
function createFakePrisma(options: {
  total: number;
  matched: number;
  congressBeaconUuid: string;
  mismatchedBeaconCount: number;
  unmatchedGroups: Array<{
    uuid: string;
    major: number;
    minor: number;
    count: number;
  }>;
}) {
  const beaconObservation = {
    count: jest
      .fn()
      .mockImplementation(({ where }: { where: { beaconId?: unknown } }) =>
        Promise.resolve(
          where.beaconId === undefined ? options.total : options.matched,
        ),
      ),
    groupBy: jest.fn().mockResolvedValue(
      options.unmatchedGroups.map((g) => ({
        uuid: g.uuid,
        major: g.major,
        minor: g.minor,
        _count: { _all: g.count },
      })),
    ),
  };
  return {
    beaconObservation,
    congress: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ beaconUuid: options.congressBeaconUuid }),
    },
    beacon: {
      count: jest.fn().mockResolvedValue(options.mismatchedBeaconCount),
    },
  };
}

function buildService(prisma: unknown) {
  return new ReportsService(prisma as never, {} as never);
}

describe('ReportsService.getDataQuality()', () => {
  it('mismatchedBeaconCount > 0 ise consistencyWarning DB tutarsizligini isaret eder', async () => {
    const prisma = createFakePrisma({
      total: 100,
      matched: 90,
      congressBeaconUuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
      mismatchedBeaconCount: 2,
      unmatchedGroups: [
        {
          uuid: '00000000-0000-0000-0000-000000000001',
          major: 0,
          minor: 1,
          count: 10,
        },
      ],
    });
    const result = await buildService(prisma).getDataQuality('congress-1');

    expect(result.mismatchedBeaconCount).toBe(2);
    expect(result.consistencyWarning).toMatch(/eslesmeyen 2 beacon/i);
  });

  it('eslesmeyen oran yuksek (>= %20, en az 20 gozlem) ise oran uyarisi verir', async () => {
    const prisma = createFakePrisma({
      total: 100,
      matched: 70,
      congressBeaconUuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
      mismatchedBeaconCount: 0,
      unmatchedGroups: [
        {
          uuid: '11111111-1111-1111-1111-111111111111',
          major: 0,
          minor: 2,
          count: 30,
        },
      ],
    });
    const result = await buildService(prisma).getDataQuality('congress-1');

    expect(result.consistencyWarning).toMatch(/%30/);
  });

  it('az veri varken (< 20 gozlem) yuksek oran YANLIS ALARM vermez', async () => {
    const prisma = createFakePrisma({
      total: 5,
      matched: 1,
      congressBeaconUuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
      mismatchedBeaconCount: 0,
      unmatchedGroups: [
        {
          uuid: '11111111-1111-1111-1111-111111111111',
          major: 0,
          minor: 2,
          count: 4,
        },
      ],
    });
    const result = await buildService(prisma).getDataQuality('congress-1');

    expect(result.consistencyWarning).toBeNull();
  });

  it('her sey tutarliysa consistencyWarning null doner', async () => {
    const prisma = createFakePrisma({
      total: 100,
      matched: 98,
      congressBeaconUuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
      mismatchedBeaconCount: 0,
      unmatchedGroups: [],
    });
    const result = await buildService(prisma).getDataQuality('congress-1');

    expect(result.consistencyWarning).toBeNull();
    expect(result.topUnmatchedBeacons).toEqual([]);
  });

  it('topUnmatchedBeacons en cok gorulenden aza dogru siralanir, ilk 10 ile sinirlanir', async () => {
    const groups = Array.from({ length: 15 }, (_, i) => ({
      uuid: `1111111${i}-1111-1111-1111-111111111111`,
      major: 0,
      minor: i,
      count: i + 1,
    }));
    const prisma = createFakePrisma({
      total: 200,
      matched: 80,
      congressBeaconUuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
      mismatchedBeaconCount: 0,
      unmatchedGroups: groups,
    });
    const result = await buildService(prisma).getDataQuality('congress-1');

    expect(result.topUnmatchedBeacons).toHaveLength(10);
    expect(result.topUnmatchedBeacons[0].count).toBe(15);
    expect(result.topUnmatchedBeacons[9].count).toBe(6);
  });
});
