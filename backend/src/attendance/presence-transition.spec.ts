import { PresenceStatus } from '../../generated/prisma/client';
import {
  Decision,
  HallScore,
  OpenVisitSnapshot,
  PresenceStateSnapshot,
  transition,
} from './presence-transition';

const CONFIG = {
  entryProbabilityThreshold: 60,
  exitProbabilityThreshold: 40,
};

const OBSERVED_AT = new Date('2026-07-22T10:00:00.000Z');
const LAST_CONFIRMED_AT = new Date('2026-07-22T09:58:00.000Z');

function score(
  hallId: string,
  percentage: number,
  passesThreshold = true,
): HallScore {
  return {
    hallId,
    emaAverage: -65,
    percentage,
    passesThreshold,
    beaconReadings: [
      { beaconId: `${hallId}-beacon`, emaValue: -65, rawAccepted: true },
    ],
  };
}

function decisionOf(
  scores: HallScore[],
  overrides: Partial<Decision> = {},
): Decision {
  const sorted = [...scores].sort((a, b) => b.percentage - a.percentage);
  const passing = sorted.filter((s) => s.passesThreshold);
  return {
    scores: sorted,
    topHallId: passing[0]?.hallId ?? null,
    topPercentage: passing[0]?.percentage ?? 0,
    runnerUpGapPct:
      passing.length >= 2 ? passing[0].percentage - passing[1].percentage : 100,
    isAmbiguous: false,
    rejectedOutliers: 0,
    ...overrides,
  };
}

const IDLE_STATE: PresenceStateSnapshot = {
  candidateHallId: null,
  candidateStreak: 0,
  nonQualifyingStreak: 0,
};

const OPEN_VISIT: OpenVisitSnapshot = {
  id: 'visit-1',
  hallId: 'salon-1',
  lastConfirmedAt: LAST_CONFIRMED_AT,
};

function run(
  state: PresenceStateSnapshot,
  openVisit: OpenVisitSnapshot | null,
  decision: Decision,
) {
  return transition({
    state,
    openVisit,
    decision,
    config: CONFIG,
    observedAt: OBSERVED_AT,
  });
}

describe('giris (ardisik iki olcum kurali)', () => {
  it('tek olcumde giris acmaz, yalnizca adayi isaretler', () => {
    const result = run(IDLE_STATE, null, decisionOf([score('salon-1', 95)]));

    expect(result.effects).toEqual([]);
    expect(result.nextState.candidateHallId).toBe('salon-1');
    expect(result.nextState.candidateStreak).toBe(1);
    expect(result.nextState.currentStatus).toBe(PresenceStatus.NO_SIGNAL);
  });

  it('ikinci ardisik olcumde girisi resmilestirir', () => {
    const result = run(
      {
        candidateHallId: 'salon-1',
        candidateStreak: 1,
        nonQualifyingStreak: 0,
      },
      null,
      decisionOf([score('salon-1', 95)]),
    );

    expect(result.effects).toEqual([
      {
        kind: 'open-visit',
        hallId: 'salon-1',
        startedAt: OBSERVED_AT,
        percentage: 95,
      },
    ]);
    expect(result.nextState.currentStatus).toBe(PresenceStatus.IN_HALL);
    expect(result.nextState.candidateStreak).toBe(0);
  });

  it('aday salon degisirse sayaci bastan baslatir', () => {
    const result = run(
      {
        candidateHallId: 'salon-1',
        candidateStreak: 1,
        nonQualifyingStreak: 0,
      },
      null,
      decisionOf([score('salon-2', 95)]),
    );

    expect(result.effects).toEqual([]);
    expect(result.nextState.candidateHallId).toBe('salon-2');
    expect(result.nextState.candidateStreak).toBe(1);
  });

  it('giris esiginin altindaki yuzdede aday takibini sifirlar', () => {
    const result = run(
      {
        candidateHallId: 'salon-1',
        candidateStreak: 1,
        nonQualifyingStreak: 0,
      },
      null,
      decisionOf([score('salon-1', 55)]),
    );

    expect(result.effects).toEqual([]);
    expect(result.nextState.candidateHallId).toBeNull();
    expect(result.nextState.candidateStreak).toBe(0);
  });

  it('salon esigini gecmeyen salon aday olamaz', () => {
    const result = run(
      IDLE_STATE,
      null,
      decisionOf([score('salon-1', 100, false)]),
    );

    expect(result.effects).toEqual([]);
    expect(result.nextState.candidateHallId).toBeNull();
    expect(result.nextState.currentStatus).toBe(PresenceStatus.NO_SIGNAL);
  });
});

describe('kalma histerezisi', () => {
  it('giris esiginin altinda ama cikis esiginin ustunde ziyareti acik tutar', () => {
    // %45: girmek icin yetmez (60), ama kalmak icin yeter (40).
    // Asimetrik esigin tum amaci bu.
    const result = run(
      IDLE_STATE,
      OPEN_VISIT,
      decisionOf([score('salon-1', 45)]),
    );

    expect(result.effects).toEqual([
      {
        kind: 'touch-last-confirmed',
        visitId: 'visit-1',
        observedAt: OBSERVED_AT,
      },
    ]);
    expect(result.nextState.nonQualifyingStreak).toBe(0);
    expect(result.nextState.currentStatus).toBe(PresenceStatus.IN_HALL);
  });

  it('yuzde yeterli olsa da salon esigi dustuyse ziyareti acik tutmaz', () => {
    // Koridora cikmis ama hala tek basina o salonu goren katilimci:
    // yuzde %100 ama sinyal salon esiginin altinda.
    const result = run(
      IDLE_STATE,
      OPEN_VISIT,
      decisionOf([score('salon-1', 100, false)]),
    );

    expect(result.effects).toEqual([]);
    expect(result.nextState.nonQualifyingStreak).toBe(1);
  });
});

describe('cikis (ardisik iki olcum kurali)', () => {
  it('tek dusuk olcumde cikis yapmaz, sayaci ilerletir', () => {
    const result = run(
      IDLE_STATE,
      OPEN_VISIT,
      decisionOf([score('salon-1', 35)]),
    );

    expect(result.effects).toEqual([]);
    expect(result.nextState.nonQualifyingStreak).toBe(1);
    expect(result.nextState.currentStatus).toBe(PresenceStatus.IN_HALL);
  });

  it('ikinci dusuk olcumde ziyareti kapatir', () => {
    const result = run(
      { candidateHallId: null, candidateStreak: 0, nonQualifyingStreak: 1 },
      OPEN_VISIT,
      decisionOf([score('salon-1', 35)]),
    );

    expect(result.effects).toEqual([
      {
        kind: 'close-visit',
        visitId: 'visit-1',
        hallId: 'salon-1',
        // Cikis ani son dogrulanmis andir, olcum ani degil.
        endedAt: LAST_CONFIRMED_AT,
        percentage: 35,
      },
    ]);
    expect(result.nextState.nonQualifyingStreak).toBe(0);
    expect(result.nextState.currentStatus).toBe(PresenceStatus.NO_SIGNAL);
  });

  it('hic sinyal gelmediginde de cikis sayaci isler', () => {
    const result = run(
      { candidateHallId: null, candidateStreak: 0, nonQualifyingStreak: 1 },
      OPEN_VISIT,
      decisionOf([]),
    );

    expect(result.effects[0]).toMatchObject({
      kind: 'close-visit',
      percentage: 0,
    });
    expect(result.nextState.currentStatus).toBe(PresenceStatus.NO_SIGNAL);
  });
});

describe('salon degisimi', () => {
  it('ayni gecisde eski ziyareti kapatip yenisini acar', () => {
    const result = run(
      {
        candidateHallId: 'salon-2',
        candidateStreak: 1,
        nonQualifyingStreak: 0,
      },
      OPEN_VISIT,
      decisionOf([score('salon-2', 92), score('salon-1', 8)]),
    );

    expect(result.effects).toEqual([
      {
        kind: 'close-visit',
        visitId: 'visit-1',
        hallId: 'salon-1',
        endedAt: LAST_CONFIRMED_AT,
        percentage: 8,
      },
      {
        kind: 'open-visit',
        hallId: 'salon-2',
        startedAt: OBSERVED_AT,
        percentage: 92,
      },
    ]);
    expect(result.nextState.currentStatus).toBe(PresenceStatus.IN_HALL);
  });

  it('eski ziyaret cikis sayaciyla kapandiysa ikinci kez kapatmaz', () => {
    const result = run(
      {
        candidateHallId: 'salon-2',
        candidateStreak: 1,
        nonQualifyingStreak: 1,
      },
      OPEN_VISIT,
      decisionOf([score('salon-2', 92), score('salon-1', 8)]),
    );

    const closeEffects = result.effects.filter((e) => e.kind === 'close-visit');
    expect(closeEffects).toHaveLength(1);
    expect(result.effects.filter((e) => e.kind === 'open-visit')).toHaveLength(
      1,
    );
  });
});

describe('belirsizlik (AMBIGUOUS)', () => {
  const ambiguous = decisionOf([score('salon-1', 51), score('salon-2', 49)], {
    isAmbiguous: true,
    runnerUpGapPct: 2,
  });

  it('ne giris ne cikis tetikler, sayaclari dondurur', () => {
    const result = run(
      {
        candidateHallId: 'salon-1',
        candidateStreak: 1,
        nonQualifyingStreak: 1,
      },
      null,
      ambiguous,
    );

    expect(result.effects).toEqual([]);
    expect(result.nextState).toEqual({
      candidateHallId: 'salon-1',
      candidateStreak: 1,
      nonQualifyingStreak: 1,
      currentStatus: PresenceStatus.AMBIGUOUS,
    });
  });

  it('acik ziyaretin salonu adaylardan biriyse ziyareti canli tutar', () => {
    // Iki salon arasindaki duvarda oturan katilimcinin tek bir uzun ziyareti,
    // stale-sweep tarafindan parcalanmamali.
    const result = run(IDLE_STATE, OPEN_VISIT, ambiguous);

    expect(result.effects).toEqual([
      {
        kind: 'touch-last-confirmed',
        visitId: 'visit-1',
        observedAt: OBSERVED_AT,
      },
    ]);
    expect(result.nextState.currentStatus).toBe(PresenceStatus.AMBIGUOUS);
  });

  it('acik ziyaretin salonu adaylar arasinda degilse ziyareti tazelemez', () => {
    const elsewhere = decisionOf([score('salon-2', 51), score('salon-3', 49)], {
      isAmbiguous: true,
      runnerUpGapPct: 2,
    });
    const result = run(IDLE_STATE, OPEN_VISIT, elsewhere);

    expect(result.effects).toEqual([]);
  });
});
