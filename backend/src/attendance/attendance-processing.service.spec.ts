import { PresenceStatus } from '../../generated/prisma/client';
import { AttendanceProcessingService } from './attendance-processing.service';
import type { AcceptedSnapshot } from '../observations/observation-ingestion.service';
import type { BeaconSignalState } from './signal/beacon-signal-store';

const USER_ID = 'user-1';
const CONGRESS_ID = 'congress-1';

const CONGRESS_CONFIG = {
  emaAlpha: 0.35,
  hampelK: 3,
  hampelWindowSize: 5,
  confidenceTemperature: 8,
  entryProbabilityThreshold: 60,
  exitProbabilityThreshold: 40,
  ambiguityMarginPct: 5,
  staleGraceSeconds: 5,
};

const ASSIGNMENTS = [
  {
    beaconId: 'beacon-1',
    hallId: 'salon-1',
    hall: { rssiThreshold: -70 },
  },
  {
    beaconId: 'beacon-2',
    hallId: 'salon-2',
    hall: { rssiThreshold: -70 },
  },
  // Salon 1'in ikinci beacon'i - salon ici birlestirme ve karar izi testleri icin.
  {
    beaconId: 'beacon-3',
    hallId: 'salon-1',
    hall: { rssiThreshold: -70 },
  },
];

type CreatedVisit = { id: string; hallId: string; confidenceLevel: string };
type CreatedEvent = {
  type: string;
  hallId: string;
  confidenceScore: number;
  decisionTrace: { rejectedOutliers: number; runnerUpGapPct: number };
};

function createFakePrisma() {
  const presenceState = {
    userId: USER_ID,
    candidateHallId: null as string | null,
    candidateStreak: 0,
    nonQualifyingStreak: 0,
    openHallVisitId: null as string | null,
    currentStatus: PresenceStatus.NO_SIGNAL as PresenceStatus,
  };

  const visits = new Map<string, Record<string, unknown>>();
  const createdVisits: CreatedVisit[] = [];
  const createdEvents: CreatedEvent[] = [];

  const tx = {
    userPresenceState: {
      findUnique: () => Promise.resolve(presenceState),
      create: () => Promise.resolve(presenceState),
      update: ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(presenceState, data);
        return Promise.resolve(presenceState);
      },
    },
    hallVisit: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(visits.get(where.id) ?? null),
      create: ({ data }: { data: Record<string, unknown> }) => {
        const visit = { id: `visit-${visits.size + 1}`, ...data };
        visits.set(visit.id, visit);
        createdVisits.push(visit as unknown as CreatedVisit);
        return Promise.resolve(visit);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const visit = visits.get(where.id) ?? {};
        Object.assign(visit, data);
        return Promise.resolve(visit);
      },
    },
    attendanceEvent: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        createdEvents.push(data as unknown as CreatedEvent);
        return Promise.resolve(data);
      },
    },
  };

  const prisma = {
    congress: {
      findUnique: () => Promise.resolve(CONGRESS_CONFIG),
    },
    hallBeacon: {
      findMany: () => Promise.resolve(ASSIGNMENTS),
    },
    $transaction: (fn: (client: typeof tx) => Promise<void>) => fn(tx),
  };

  return { prisma, presenceState, createdVisits, createdEvents };
}

// Gercek BeaconSignalStore gibi davranan, bellekte durum tutan sahte store.
// Snapshot'lar arasi durumun tasinmasi, pencere kaymasi testleri icin sart.
function createFakeStore(initial: Map<string, BeaconSignalState> = new Map()) {
  const bumped: { accepted: number; rejected: number }[] = [];
  const state = new Map(initial);
  const store = {
    loadMany: (_userId: string, beaconIds: string[]) => {
      const result = new Map<string, BeaconSignalState>();
      for (const beaconId of beaconIds) {
        const value = state.get(beaconId);
        if (value) result.set(beaconId, value);
      }
      return Promise.resolve(result);
    },
    saveMany: (_userId: string, states: Map<string, BeaconSignalState>) => {
      for (const [beaconId, value] of states) {
        state.set(beaconId, value);
      }
      return Promise.resolve();
    },
    bumpCounters: (_userId: string, accepted: number, rejected: number) => {
      bumped.push({ accepted, rejected });
      return Promise.resolve();
    },
  };
  return { store, bumped, state };
}

function snapshot(
  observedAtIso: string,
  readings: { beaconId: string; rssi: number }[],
): AcceptedSnapshot {
  return {
    observationId: `obs-${observedAtIso}`,
    observedAt: new Date(observedAtIso),
    readings: readings.map((reading, index) => ({
      beaconId: reading.beaconId,
      uuid: 'uuid',
      major: 1,
      minor: index + 1,
      rssi: reading.rssi,
    })),
  };
}

function buildService(
  prisma: ReturnType<typeof createFakePrisma>['prisma'],
  store: ReturnType<typeof createFakeStore>['store'],
) {
  return new AttendanceProcessingService(prisma as never, store as never);
}

describe('AttendanceProcessingService', () => {
  it('iki ardisik guclu olcumden sonra ziyaret acar', async () => {
    const { prisma, createdVisits, createdEvents, presenceState } =
      createFakePrisma();
    const { store } = createFakeStore();
    const service = buildService(prisma, store);

    await service.processSnapshots(USER_ID, CONGRESS_ID, [
      snapshot('2026-07-22T10:00:00.000Z', [
        { beaconId: 'beacon-1', rssi: -60 },
      ]),
      snapshot('2026-07-22T10:00:10.000Z', [
        { beaconId: 'beacon-1', rssi: -60 },
      ]),
    ]);

    expect(createdVisits).toHaveLength(1);
    expect(createdVisits[0].hallId).toBe('salon-1');
    expect(createdVisits[0].confidenceLevel).toBe('yuksek');
    expect(createdEvents).toHaveLength(1);
    expect(createdEvents[0].type).toBe('ENTRY');
    // Tek salon goruluyor -> softmax %100 (yuzde gorecelik olcer, kalite degil)
    expect(createdEvents[0].confidenceScore).toBeCloseTo(100, 6);
    expect(createdEvents[0].decisionTrace).toBeDefined();
    expect(presenceState.currentStatus).toBe(PresenceStatus.IN_HALL);
  });

  it('snapshotlari zaman sirasina gore isler', async () => {
    const { prisma, createdVisits } = createFakePrisma();
    const { store } = createFakeStore();
    const service = buildService(prisma, store);

    // Bilincli olarak ters sirada verildi.
    await service.processSnapshots(USER_ID, CONGRESS_ID, [
      snapshot('2026-07-22T10:00:10.000Z', [
        { beaconId: 'beacon-1', rssi: -60 },
      ]),
      snapshot('2026-07-22T10:00:00.000Z', [
        { beaconId: 'beacon-1', rssi: -60 },
      ]),
    ]);

    expect(createdVisits).toHaveLength(1);
    expect(
      (createdVisits[0] as unknown as { startedAt: Date }).startedAt,
    ).toEqual(new Date('2026-07-22T10:00:10.000Z'));
  });

  it('sentinel rssi = 0 okumasini karar hesabina almaz', async () => {
    const { prisma, createdVisits } = createFakePrisma();
    const { store, bumped } = createFakeStore();
    const service = buildService(prisma, store);

    await service.processSnapshots(USER_ID, CONGRESS_ID, [
      snapshot('2026-07-22T10:00:00.000Z', [{ beaconId: 'beacon-1', rssi: 0 }]),
      snapshot('2026-07-22T10:00:10.000Z', [{ beaconId: 'beacon-1', rssi: 0 }]),
    ]);

    expect(createdVisits).toHaveLength(0);
    expect(bumped).toEqual([
      { accepted: 0, rejected: 1 },
      { accepted: 0, rejected: 1 },
    ]);
  });

  it('Hampel penceresine gore anormal okumayi reddeder', async () => {
    const { prisma, createdVisits } = createFakePrisma();
    const { store, bumped } = createFakeStore(
      new Map([
        [
          'beacon-1',
          {
            emaValue: -70,
            recentRssi: [-72, -70, -68, -70, -71],
            updatedAt: '2026-07-22T09:59:00.000Z',
          },
        ],
      ]),
    );
    const service = buildService(prisma, store);

    await service.processSnapshots(USER_ID, CONGRESS_ID, [
      snapshot('2026-07-22T10:00:00.000Z', [
        { beaconId: 'beacon-1', rssi: -40 },
      ]),
    ]);

    expect(bumped).toEqual([{ accepted: 0, rejected: 1 }]);
    expect(createdVisits).toHaveLength(0);
  });

  it('outlier reddedilse bile pencere kayar (kilitlenmeyi onler)', async () => {
    const { prisma } = createFakePrisma();
    const { store, state } = createFakeStore(
      new Map([
        [
          'beacon-1',
          {
            emaValue: -70,
            recentRssi: [-72, -70, -68, -70, -71],
            updatedAt: '2026-07-22T09:59:00.000Z',
          },
        ],
      ]),
    );
    const service = buildService(prisma, store);

    await service.processSnapshots(USER_ID, CONGRESS_ID, [
      snapshot('2026-07-22T10:00:00.000Z', [
        { beaconId: 'beacon-1', rssi: -40 },
      ]),
    ]);

    const after = state.get('beacon-1') as BeaconSignalState;
    // Okuma EMA'ya beslenmedi...
    expect(after.emaValue).toBe(-70);
    // ...ama pencere yine de kaydi: aksi halde referans eski konumda kalici
    // olarak kilitlenir ve katilimci hareket ettiginde beacon hic
    // izlenemez hale gelirdi.
    expect(after.recentRssi).toEqual([-70, -68, -70, -71, -40]);
  });

  it('karar izinde elenen okumayi rawAccepted:false olarak gosterir', async () => {
    const { prisma, createdEvents } = createFakePrisma();
    const { store } = createFakeStore(
      new Map([
        [
          'beacon-3',
          {
            emaValue: -70,
            recentRssi: [-72, -70, -68, -70, -71],
            updatedAt: '2026-07-22T09:59:00.000Z',
          },
        ],
      ]),
    );
    const service = buildService(prisma, store);

    // Ayni salonun (Salon 1) iki beacon'i: biri temiz, digeri anormal deger
    // donuyor. Salon yine aday olur ama elenen beacon izde gorunmelidir.
    await service.processSnapshots(USER_ID, CONGRESS_ID, [
      snapshot('2026-07-22T10:00:00.000Z', [
        { beaconId: 'beacon-1', rssi: -60 },
        { beaconId: 'beacon-3', rssi: -20 },
      ]),
      snapshot('2026-07-22T10:00:10.000Z', [
        { beaconId: 'beacon-1', rssi: -60 },
        { beaconId: 'beacon-3', rssi: -20 },
      ]),
    ]);

    expect(createdEvents).toHaveLength(1);
    const trace = createdEvents[0].decisionTrace as unknown as {
      rejectedOutliers: number;
      candidates: {
        hallId: string;
        beaconReadings: { beaconId: string; rawAccepted: boolean }[];
      }[];
    };

    expect(trace.rejectedOutliers).toBe(1);
    // Elenen beacon, ortalamaya girmese de kendi salonunun izinde gorunur -
    // "bu beacon neden hesaba katilmadi" sorusu ancak boyle cevaplanabilir.
    const allReadings = trace.candidates.flatMap((c) => c.beaconReadings);
    expect(
      allReadings.find((r) => r.beaconId === 'beacon-3')?.rawAccepted,
    ).toBe(false);
    expect(
      allReadings.find((r) => r.beaconId === 'beacon-1')?.rawAccepted,
    ).toBe(true);
  });

  describe('grace suresi (saha testinde bulunan "isinlanma" hatasinin duzeltmesi)', () => {
    // Gercek saha testinde bulunan hata: Salon 2'nin TEK beacon'i 2 ardisik
    // turda gecersiz (sentinel) okuma dondurunce, Salon 2 aday listesinden
    // tamamen dusuyor, Salon 1 (baska bir beacon'i o an gecerli oldugu icin)
    // "tek aday" sayilip %100 alarak aninda kazaniyordu - katilimci hic
    // kipirdamamis olsa bile. Grace suresi, son gercekten gecerli okumadan
    // itibaren birkac saniye boyunca eski EMA'yi ORTALAMAYA DAHIL ETMEYE
    // devam ederek bunu onler.
    it('tek beacon kisa sureli (grace icinde) gecersiz okuma dondurunce rakip salona gecis yapmaz', async () => {
      const { prisma, createdVisits, createdEvents, presenceState } =
        createFakePrisma();
      const { store } = createFakeStore();
      const service = buildService(prisma, store);

      // Salon 2'ye (tek beacon: beacon-2) net giris yapilir.
      await service.processSnapshots(USER_ID, CONGRESS_ID, [
        snapshot('2026-07-22T10:00:00.000Z', [
          { beaconId: 'beacon-2', rssi: -30 },
        ]),
        snapshot('2026-07-22T10:00:01.000Z', [
          { beaconId: 'beacon-2', rssi: -30 },
        ]),
      ]);
      expect(createdVisits).toHaveLength(1);
      expect(createdVisits[0].hallId).toBe('salon-2');

      // Simdi beacon-2, 2 ardisik turda sentinel (0) donuyor - saha testindeki
      // tam senaryo - Salon 1'in (beacon-1) beacon'i ise gecerli okuma veriyor.
      // Aradaki sure grace penceresinin (5sn) cok altinda (1sn).
      await service.processSnapshots(USER_ID, CONGRESS_ID, [
        snapshot('2026-07-22T10:00:02.000Z', [
          { beaconId: 'beacon-2', rssi: 0 },
          { beaconId: 'beacon-1', rssi: -60 },
        ]),
        snapshot('2026-07-22T10:00:03.000Z', [
          { beaconId: 'beacon-2', rssi: 0 },
          { beaconId: 'beacon-1', rssi: -60 },
        ]),
      ]);

      // Hala tek ziyaret var (Salon 2), hicbir EXIT/ENTRY cifti olusmadi -
      // "isinlanma" YOK.
      expect(createdVisits).toHaveLength(1);
      expect(createdEvents.filter((e) => e.type === 'EXIT')).toHaveLength(0);
      expect(presenceState.currentStatus).toBe(PresenceStatus.IN_HALL);
    });

    it('grace suresi dolunca eski EMA artik kullanilmaz, gercek gecis olusabilir', async () => {
      const { prisma, createdVisits, presenceState } = createFakePrisma();
      const { store } = createFakeStore();
      const service = buildService(prisma, store);

      await service.processSnapshots(USER_ID, CONGRESS_ID, [
        snapshot('2026-07-22T10:00:00.000Z', [
          { beaconId: 'beacon-2', rssi: -30 },
        ]),
        snapshot('2026-07-22T10:00:01.000Z', [
          { beaconId: 'beacon-2', rssi: -30 },
        ]),
      ]);
      expect(createdVisits).toHaveLength(1);

      // Bu kez beacon-2'nin son gecerli okumasindan (10:00:01) sonraki
      // olcumler grace suresini (5sn) acikca asiyor (20sn, 21sn sonra).
      await service.processSnapshots(USER_ID, CONGRESS_ID, [
        snapshot('2026-07-22T10:00:21.000Z', [
          { beaconId: 'beacon-2', rssi: 0 },
          { beaconId: 'beacon-1', rssi: -60 },
        ]),
        snapshot('2026-07-22T10:00:22.000Z', [
          { beaconId: 'beacon-2', rssi: 0 },
          { beaconId: 'beacon-1', rssi: -60 },
        ]),
      ]);

      // Grace suresiz - eski davranis: Salon 2 gercekten aday disi kalir,
      // Salon 1'e gecis GERCEKLESIR. Grace'in "sonsuz" olmadiginin kaniti.
      expect(createdVisits).toHaveLength(2);
      expect(createdVisits[1].hallId).toBe('salon-1');
      expect(presenceState.currentStatus).toBe(PresenceStatus.IN_HALL);
    });

    it('taramada hic gorunmeyen (sentinel bile olmayan) beacon icin de grace uygulanir', async () => {
      const { prisma, createdVisits, createdEvents } = createFakePrisma();
      const { store } = createFakeStore();
      const service = buildService(prisma, store);

      await service.processSnapshots(USER_ID, CONGRESS_ID, [
        snapshot('2026-07-22T10:00:00.000Z', [
          { beaconId: 'beacon-2', rssi: -30 },
        ]),
        snapshot('2026-07-22T10:00:01.000Z', [
          { beaconId: 'beacon-2', rssi: -30 },
        ]),
      ]);

      // beacon-2 bu turlarda okuma listesinde HIC yok (sentinel bile degil) -
      // telefon taramada hic yakalayamadi. beacon-1 gecerli.
      await service.processSnapshots(USER_ID, CONGRESS_ID, [
        snapshot('2026-07-22T10:00:02.000Z', [
          { beaconId: 'beacon-1', rssi: -60 },
        ]),
        snapshot('2026-07-22T10:00:03.000Z', [
          { beaconId: 'beacon-1', rssi: -60 },
        ]),
      ]);

      expect(createdVisits).toHaveLength(1);
      expect(createdEvents.filter((e) => e.type === 'EXIT')).toHaveLength(0);
    });

    it('donmus (grace) okuma karar izinde stale:true olarak isaretlenir', async () => {
      const { prisma, createdEvents } = createFakePrisma();
      const { store } = createFakeStore();
      const service = buildService(prisma, store);

      // Salon 1'in iki beacon'i: ilk turda ikisi de taze. Ikinci (dogrulama)
      // turunda beacon-3 taramada hic gorunmuyor ama son gecerli okumasindan
      // yalnizca 1sn gecmis (grace=5sn icinde) - donmus EMA'siyla ortalamaya
      // katilmaya devam etmeli ve giris onaylanmali.
      await service.processSnapshots(USER_ID, CONGRESS_ID, [
        snapshot('2026-07-22T10:00:00.000Z', [
          { beaconId: 'beacon-1', rssi: -50 },
          { beaconId: 'beacon-3', rssi: -50 },
        ]),
        snapshot('2026-07-22T10:00:01.000Z', [
          { beaconId: 'beacon-1', rssi: -50 },
        ]),
      ]);

      expect(createdEvents).toHaveLength(1);
      const trace = createdEvents[0].decisionTrace as unknown as {
        candidates: {
          hallId: string;
          beaconReadings: {
            beaconId: string;
            rawAccepted: boolean;
            stale?: boolean;
          }[];
        }[];
      };
      const readings = trace.candidates.flatMap((c) => c.beaconReadings);
      expect(readings.find((r) => r.beaconId === 'beacon-3')?.stale).toBe(true);
      expect(readings.find((r) => r.beaconId === 'beacon-1')?.rawAccepted).toBe(
        true,
      );
    });
  });

  it('surekli bir sinyal degisimine birkac olcumde yeniden uyum saglar', async () => {
    const { prisma, createdVisits } = createFakePrisma();
    const { store } = createFakeStore(
      new Map([
        [
          'beacon-1',
          {
            emaValue: -70,
            recentRssi: [-72, -70, -68, -70, -71],
            updatedAt: '2026-07-22T09:59:00.000Z',
          },
        ],
      ]),
    );
    const service = buildService(prisma, store);

    // Katilimci beacon'a dogru yuruyor: kademeli ama surekli bir yukselis.
    const ramp = [-68, -66, -64, -62, -60, -58, -56, -55, -55, -55];
    await service.processSnapshots(
      USER_ID,
      CONGRESS_ID,
      ramp.map((rssi, index) =>
        snapshot(
          new Date(
            Date.parse('2026-07-22T10:00:00.000Z') + index * 10_000,
          ).toISOString(),
          [{ beaconId: 'beacon-1', rssi }],
        ),
      ),
    );

    // Pencere kaydigi icin filtre yeni gercekligi ogrenir ve giris acilir.
    expect(createdVisits).toHaveLength(1);
    expect(createdVisits[0].hallId).toBe('salon-1');
  });

  it('iki salon neredeyse esitken giris acmaz ve durumu belirsiz isaretler', async () => {
    const { prisma, createdVisits, presenceState } = createFakePrisma();
    const { store } = createFakeStore();
    const service = buildService(prisma, store);

    await service.processSnapshots(USER_ID, CONGRESS_ID, [
      snapshot('2026-07-22T10:00:00.000Z', [
        { beaconId: 'beacon-1', rssi: -65 },
        { beaconId: 'beacon-2', rssi: -65 },
      ]),
      snapshot('2026-07-22T10:00:10.000Z', [
        { beaconId: 'beacon-1', rssi: -65 },
        { beaconId: 'beacon-2', rssi: -65 },
      ]),
    ]);

    expect(createdVisits).toHaveLength(0);
    expect(presenceState.currentStatus).toBe(PresenceStatus.AMBIGUOUS);
  });

  it('salon esigini gecmeyen zayif sinyalde giris acmaz', async () => {
    const { prisma, createdVisits, presenceState } = createFakePrisma();
    const { store } = createFakeStore();
    const service = buildService(prisma, store);

    await service.processSnapshots(USER_ID, CONGRESS_ID, [
      snapshot('2026-07-22T10:00:00.000Z', [
        { beaconId: 'beacon-1', rssi: -85 },
      ]),
      snapshot('2026-07-22T10:00:10.000Z', [
        { beaconId: 'beacon-1', rssi: -85 },
      ]),
    ]);

    expect(createdVisits).toHaveLength(0);
    expect(presenceState.currentStatus).toBe(PresenceStatus.NO_SIGNAL);
  });

  it('Redis gecmisi bossa (cache miss) yumusatmasiz da karar uretir', async () => {
    // BeaconSignalStore, Redis erisilemedigi zaman da tam olarak bunu doner:
    // bos gecmis. Store'un kendi dayanikliligi beacon-signal-store.spec.ts'te
    // ayrica test ediliyor.
    const { prisma, createdVisits } = createFakePrisma();
    const { store } = createFakeStore(new Map());
    const service = buildService(prisma, store);

    await service.processSnapshots(USER_ID, CONGRESS_ID, [
      snapshot('2026-07-22T10:00:00.000Z', [
        { beaconId: 'beacon-1', rssi: -60 },
      ]),
      snapshot('2026-07-22T10:00:10.000Z', [
        { beaconId: 'beacon-1', rssi: -60 },
      ]),
    ]);

    expect(createdVisits).toHaveLength(1);
    expect(createdVisits[0].hallId).toBe('salon-1');
  });
});
