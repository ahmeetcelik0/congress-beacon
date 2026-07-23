import { PresenceStatus } from '../../generated/prisma/client';

// Salon tespit algoritmasi v3, Katman 5: zaman ici dogrulama ve durum atamasi.
//
// Bu dosya bilincli olarak SAF tutuldu - Prisma, Redis, tarih/saat kaynagi
// yok. Karar mantigi burada, yazma islemleri AttendanceProcessingService'te.
// Boylece giris/cikis/belirsizlik senaryolari veritabani olmadan, dogrudan
// birim testiyle dogrulanabiliyor.

const ENTRY_STREAK_THRESHOLD = 2;
const EXIT_STREAK_THRESHOLD = 2;

export type HallScore = {
  hallId: string;
  emaAverage: number;
  percentage: number;
  // Salon-seviyesi karar esigi (Hall.rssiThreshold) gecildi mi. Yuzde tek
  // basina yeterli DEGIL: tek salon goruluyorsa yuzde her zaman %100 cikar.
  passesThreshold: boolean;
  beaconReadings: {
    beaconId: string;
    emaValue: number;
    rawAccepted: boolean;
    // true ise: bu beacon bu turda taze veri vermedi, gosterilen deger
    // grace suresi icindeki SON BILINEN (donmus) EMA'dir. Bkz.
    // AttendanceProcessingService.computeDecision, grace-fallback pass.
    stale?: boolean;
  }[];
};

export type Decision = {
  // Yuzdeye gore azalan sirali, o an sinyali gorulen TUM salonlar.
  scores: HallScore[];
  // Nihai aday: en yuksek yuzdeye sahip VE salon esigini gecen salon.
  topHallId: string | null;
  topPercentage: number;
  // Esigi gecen ilk iki salon arasindaki yuzde farki (tek aday varsa 100).
  runnerUpGapPct: number;
  isAmbiguous: boolean;
  rejectedOutliers: number;
};

export type TuningConfig = {
  entryProbabilityThreshold: number;
  exitProbabilityThreshold: number;
};

export type PresenceStateSnapshot = {
  candidateHallId: string | null;
  candidateStreak: number;
  nonQualifyingStreak: number;
};

export type OpenVisitSnapshot = {
  id: string;
  hallId: string;
  lastConfirmedAt: Date;
};

export type TransitionEffect =
  | { kind: 'touch-last-confirmed'; visitId: string; observedAt: Date }
  | {
      kind: 'close-visit';
      visitId: string;
      hallId: string;
      endedAt: Date;
      percentage: number;
    }
  | {
      kind: 'open-visit';
      hallId: string;
      startedAt: Date;
      percentage: number;
    };

export type TransitionResult = {
  effects: TransitionEffect[];
  // openHallVisitId burada YOK: yeni ziyaretin id'si ancak veritabanina
  // yazildiktan sonra bilinir, o yuzden servis tarafinda ayarlanir.
  nextState: {
    candidateHallId: string | null;
    candidateStreak: number;
    nonQualifyingStreak: number;
    currentStatus: PresenceStatus;
  };
};

export type TransitionInput = {
  state: PresenceStateSnapshot;
  openVisit: OpenVisitSnapshot | null;
  decision: Decision;
  config: TuningConfig;
  observedAt: Date;
};

// NO_SIGNAL iki farkli gercekligi tek etikette birlestirir (bilincli
// basitlestirme, bkz. schema.prisma'daki PresenceStatus yorumu):
// (a) cihaz veri gonderiyor ama hicbir salon esigini gecmiyor - zayif sinyal,
//     koridor, kalibrasyonsuz bolge;
// (b) cihaz tamamen sessiz.
// Ayrim kaybolmuyor: Takip Sagligi sayfasi lastObservationAt uzerinden ikisini
// birbirinden ayirabiliyor.
function statusFor(hasOpenVisit: boolean): PresenceStatus {
  return hasOpenVisit ? PresenceStatus.IN_HALL : PresenceStatus.NO_SIGNAL;
}

export function transition({
  state,
  openVisit,
  decision,
  config,
  observedAt,
}: TransitionInput): TransitionResult {
  const effects: TransitionEffect[] = [];

  // --- Belirsizlik: iki salon neredeyse esit ---
  // Sistem zorla bir taraf secmez. Streak'ler DONDURULUR (ne artar ne sifirlanir):
  // belirsizlik "yeni kanit yok" demektir; onceki kaniti silmek de bunu yeni
  // kanit saymak da yanlis olurdu.
  if (decision.isAmbiguous) {
    const openHallIsCandidate =
      openVisit !== null &&
      decision.scores
        .slice(0, 2)
        .some((score) => score.hallId === openVisit.hallId);

    // Acik ziyaretin salonu belirsiz adaylardan biriyse ziyaret canli tutulur.
    // Aksi halde iki salon arasindaki duvarda oturan bir katilimcinin tek bir
    // 60 dakikalik ziyareti, stale-visit-sweep tarafindan 5 dakikada bir
    // kapatilip onlarca parcaya bolunur ve kalis suresi/medyan istatistikleri
    // bozulurdu.
    if (openHallIsCandidate) {
      effects.push({
        kind: 'touch-last-confirmed',
        visitId: openVisit.id,
        observedAt,
      });
    }

    return {
      effects,
      nextState: {
        candidateHallId: state.candidateHallId,
        candidateStreak: state.candidateStreak,
        nonQualifyingStreak: state.nonQualifyingStreak,
        currentStatus: PresenceStatus.AMBIGUOUS,
      },
    };
  }

  let nonQualifyingStreak = state.nonQualifyingStreak;
  let openVisitClosed = false;

  // --- Acik ziyaret: kalma histerezisi ve cikis sayaci ---
  if (openVisit) {
    const openScore = decision.scores.find(
      (score) => score.hallId === openVisit.hallId,
    );

    // Asimetrinin asil amaci: GIRMEK icin entryProbabilityThreshold (or. %60)
    // gerekir, ama KALMAK icin exitProbabilityThreshold (or. %40) yeterli.
    // Bu araliktaki dalgalanma katilimciyi salondan cikarmaz.
    //
    // Salon esigi (passesThreshold) burada da araniyor: yalnizca yuzdeye
    // bakilsaydi, koridora cikmis ama hala tek basina o salonu goren bir
    // katilimci %100 yuzdeyle sonsuza kadar "icerde" gorunurdu.
    const staysInside =
      openScore !== undefined &&
      openScore.passesThreshold &&
      openScore.percentage >= config.exitProbabilityThreshold;

    if (staysInside) {
      effects.push({
        kind: 'touch-last-confirmed',
        visitId: openVisit.id,
        observedAt,
      });
      return {
        effects,
        nextState: {
          candidateHallId: null,
          candidateStreak: 0,
          nonQualifyingStreak: 0,
          currentStatus: PresenceStatus.IN_HALL,
        },
      };
    }

    nonQualifyingStreak += 1;

    if (nonQualifyingStreak >= EXIT_STREAK_THRESHOLD) {
      effects.push({
        kind: 'close-visit',
        visitId: openVisit.id,
        hallId: openVisit.hallId,
        // Cikis ani, son DOGRULANMIS an kabul edilir - arada gecen sure
        // katilimcinin salonda oldugu kanitlanamayan suredir.
        endedAt: openVisit.lastConfirmedAt,
        percentage: openScore?.percentage ?? 0,
      });
      openVisitClosed = true;
      nonQualifyingStreak = 0;
    }
  }

  const hasOpenVisit = openVisit !== null && !openVisitClosed;

  // --- Giris adayligi ---
  const qualifiesForEntry =
    decision.topHallId !== null &&
    decision.topPercentage >= config.entryProbabilityThreshold;

  if (!qualifiesForEntry) {
    return {
      effects,
      nextState: {
        candidateHallId: null,
        candidateStreak: 0,
        nonQualifyingStreak,
        currentStatus: statusFor(hasOpenVisit),
      },
    };
  }

  const candidateHallId = decision.topHallId as string;

  if (state.candidateHallId !== candidateHallId) {
    return {
      effects,
      nextState: {
        candidateHallId,
        candidateStreak: 1,
        nonQualifyingStreak,
        currentStatus: statusFor(hasOpenVisit),
      },
    };
  }

  const candidateStreak = state.candidateStreak + 1;

  if (candidateStreak < ENTRY_STREAK_THRESHOLD) {
    return {
      effects,
      nextState: {
        candidateHallId,
        candidateStreak,
        nonQualifyingStreak,
        currentStatus: statusFor(hasOpenVisit),
      },
    };
  }

  // --- Giris onaylandi ---
  // Bu noktaya acik ziyaret varken ancak BASKA bir salon icin gelinebilir:
  // aday salon acik ziyaretin salonuyla ayni olsaydi yukaridaki kalma
  // histerezisi zaten erken donerdi.
  if (openVisit && !openVisitClosed) {
    effects.push({
      kind: 'close-visit',
      visitId: openVisit.id,
      hallId: openVisit.hallId,
      endedAt: openVisit.lastConfirmedAt,
      percentage:
        decision.scores.find((score) => score.hallId === openVisit.hallId)
          ?.percentage ?? 0,
    });
  }

  effects.push({
    kind: 'open-visit',
    hallId: candidateHallId,
    startedAt: observedAt,
    percentage: decision.topPercentage,
  });

  return {
    effects,
    nextState: {
      candidateHallId: null,
      candidateStreak: 0,
      nonQualifyingStreak: 0,
      currentStatus: PresenceStatus.IN_HALL,
    },
  };
}
