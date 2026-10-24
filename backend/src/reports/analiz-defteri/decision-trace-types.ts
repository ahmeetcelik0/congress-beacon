// Faz 13b: `AttendanceEvent.decisionTrace`'in GERÇEK yapısı - bkz.
// `attendance-processing.service.ts` `buildDecisionTrace()`. Prisma'nın
// `Json?` alanı tip bilgisi taşımaz, bu yüzden okuyan taraf (Giriş-Çıkış
// Olayları ve Karar Detayı sayfaları) burada tanımlanan tipe CAST eder -
// yazan tarafla (`attendance-processing.service.ts`) SENKRON tutulmalı.
//
// ÜÇ NOKTA (varsayım yapmadan önce oku):
// 1. Dizinin adı `candidates`'tır, `scores` DEĞİL.
// 2. `topHallId`/`topPercentage`/`isAmbiguous` trace'te YOKTUR. `candidates`
//    zaten yüzdeye göre AZALAN sıralıdır (bkz. `computeDecision`); KAZANAN,
//    bu sırada `passesThreshold: true` olan İLK elemandır - `candidates[0]`
//    DEĞİL (en yüksek yüzdeye sahip salon eşiği geçmemiş olabilir).
//    BELİRSİZ miydi trace'te yoktur, `runnerUpGapPct < ambiguityMarginPct`
//    ile türetilir (`emptyDecision`/tek-aday durumunda `runnerUpGapPct=100`
//    olduğu için bu türetme her durumda doğru sonuç verir).
// 3. `stale` alanı yalnızca `true` iken YAZILIR, `false` iken hiç yoktur -
//    yokluğu `false` say.
export type BeaconReadingTrace = {
  beaconId: string;
  emaValue: number;
  rawAccepted: boolean;
  stale?: true;
};

export type CandidateTrace = {
  hallId: string;
  percentage: number;
  emaAverage: number;
  passesThreshold: boolean;
  beaconReadings: BeaconReadingTrace[];
};

export type DecisionTrace = {
  candidates: CandidateTrace[];
  runnerUpGapPct: number;
  rejectedOutliers: number;
  algorithmVersion: string;
};

/** ÇIKIŞ olaylarında sinyal hiç görünmediğinde `candidates` BOŞ DİZİ olabilir. */
export function kazananAday(trace: DecisionTrace): CandidateTrace | null {
  return trace.candidates.find((c) => c.passesThreshold) ?? null;
}

export function belirsizMiydi(
  trace: DecisionTrace,
  ambiguityMarginPct: number,
): boolean {
  return trace.runnerUpGapPct < ambiguityMarginPct;
}

// Excel hücresi en fazla 32.767 karakter alır - JSON metni bunu aşarsa
// SESSİZCE kesilmez, kesildiği ayrı bir sütunda işaretlenir (bkz. görev
// tanımı "İz kesilmesi").
const EXCEL_CELL_MAX_CHARS = 32767;

export function jsonIzMetni(trace: unknown): {
  metin: string;
  kesildi: boolean;
} {
  const tam = JSON.stringify(trace);
  if (tam.length <= EXCEL_CELL_MAX_CHARS) {
    return { metin: tam, kesildi: false };
  }
  return {
    metin: tam.slice(0, EXCEL_CELL_MAX_CHARS - 3) + '...',
    kesildi: true,
  };
}
