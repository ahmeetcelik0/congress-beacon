import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceEventType, Prisma } from '../../generated/prisma/client';
import { AcceptedSnapshot } from '../observations/observation-ingestion.service';
import {
  BeaconSignalState,
  BeaconSignalStore,
} from './signal/beacon-signal-store';
import {
  isHampelOutlier,
  nextEma,
  softmaxPercentages,
} from './signal/signal-math';
import {
  Decision,
  HallScore,
  transition,
  TransitionEffect,
} from './presence-transition';

const ALGORITHM_VERSION = 'v3';

// CoreLocation/flutter_beacon bazen gercek bir olcum yerine 0 dBm doner - bu,
// "bu taramada guvenilir bir deger alinamadi" anlamina gelen bir sentinel
// degeridir, gercek bir sinyal gucu DEGILDIR (gercek RSSI her zaman negatiftir).
// Bu deger filtrelenmeden ortalamaya dahil edilirse, zayif/sinir bolgesindeki
// bir beacon'in ara sira donen 0'i, gercekte cok daha guclu olan baska bir
// salonun negatif RSSI'sinden sayisal olarak "daha buyuk" gorunup yanlislikla
// en guclu sinyal sanilir - bu da salonlar arasi sahte, ani gecislere
// ("isinlanma") yol acar. Katman 1'in ilk kapisi budur.
function isValidRssi(rssi: number): boolean {
  return rssi < 0;
}

// Mevcut panellerle geriye donuk uyumluluk icin yuzdeden turetilen etiket.
function confidenceLevelFromPercentage(percentage: number): string {
  if (percentage >= 80) return 'yuksek';
  if (percentage >= 55) return 'orta';
  return 'dusuk';
}

type ProcessingContext = {
  emaAlpha: number;
  hampelK: number;
  hampelWindowSize: number;
  confidenceTemperature: number;
  entryProbabilityThreshold: number;
  exitProbabilityThreshold: number;
  ambiguityMarginPct: number;
  // Bir beacon'in son gecerli okumasindan sonra kac saniye daha "hala
  // guvenilir" sayilacagi - bkz. computeDecision icindeki grace-suresi yorumu.
  staleGraceSeconds: number;
  // beaconId -> atandigi salon ve o salonun karar esigi.
  beaconToHall: Map<string, { hallId: string; hallThreshold: number }>;
};

@Injectable()
export class AttendanceProcessingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signalStore: BeaconSignalStore,
  ) {}

  async processSnapshots(
    userId: string,
    snapshots: AcceptedSnapshot[],
  ): Promise<void> {
    const context = await this.loadContext(userId);
    if (!context) {
      return;
    }

    const ordered = [...snapshots].sort(
      (a, b) => a.observedAt.getTime() - b.observedAt.getTime(),
    );

    for (const snapshot of ordered) {
      const decision = await this.computeDecision(userId, context, snapshot);
      await this.applyDecision(userId, snapshot.observedAt, decision, context);
    }
  }

  // Batch basina BIR kez calisir. Onceki surumde salon-beacon atamalari her
  // snapshot icin yeniden sorgulaniyordu; atamalar bir batch suresince
  // degismeyecegi icin tek sorgu yeterli.
  private async loadContext(userId: string): Promise<ProcessingContext | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { congressId: true },
    });
    if (!user) {
      return null;
    }

    const congress = await this.prisma.congress.findUnique({
      where: { id: user.congressId },
      select: {
        emaAlpha: true,
        hampelK: true,
        hampelWindowSize: true,
        confidenceTemperature: true,
        entryProbabilityThreshold: true,
        exitProbabilityThreshold: true,
        ambiguityMarginPct: true,
        staleGraceSeconds: true,
      },
    });
    if (!congress) {
      return null;
    }

    const assignments = await this.prisma.hallBeacon.findMany({
      where: { isActive: true, hall: { congressId: user.congressId } },
      select: {
        beaconId: true,
        hallId: true,
        hall: { select: { rssiThreshold: true } },
      },
    });

    const beaconToHall = new Map<
      string,
      { hallId: string; hallThreshold: number }
    >();
    for (const assignment of assignments) {
      // Salon esigi her zaman salon seviyesinde tek ve nettir:
      // HallBeacon.rssiThreshold override'i v3'te karar esigi olarak
      // KULLANILMIYOR (bkz. docs/algoritma-v3-uygulama-talimati.md §5 Katman 3).
      beaconToHall.set(assignment.beaconId, {
        hallId: assignment.hallId,
        hallThreshold: assignment.hall.rssiThreshold,
      });
    }

    return { ...congress, beaconToHall };
  }

  // Katman 1-4: veri kalitesi kapisi -> zamansal yumusatma -> salon ici
  // birlestirme -> salonlar arasi guven yuzdesi.
  private async computeDecision(
    userId: string,
    context: ProcessingContext,
    snapshot: AcceptedSnapshot,
  ): Promise<Decision> {
    const allBeaconIds = [...context.beaconToHall.keys()];
    if (allBeaconIds.length === 0) {
      return emptyDecision(0);
    }

    // Bu kongreye atanmis TUM beacon'larin onceki durumu yuklenir - yalnizca
    // bu snapshot'ta gorulenler degil. Grace-suresi hesaplamasi (asagida),
    // bu turda HIC gorulmeyen bir beacon'in bile son bilinen EMA'sini
    // kullanabilmek icin gecmisine ihtiyac duyar.
    const previousStates = await this.signalStore.loadMany(
      userId,
      allBeaconIds,
    );

    const readingByBeacon = new Map(
      snapshot.readings
        .filter(
          (reading) =>
            reading.beaconId && context.beaconToHall.has(reading.beaconId),
        )
        .map((reading) => [reading.beaconId as string, reading] as const),
    );

    const nextStates = new Map<string, BeaconSignalState>();
    const emaByBeacon = new Map<string, number>();
    const readingTrace = new Map<
      string,
      {
        beaconId: string;
        emaValue: number;
        rawAccepted: boolean;
        stale?: boolean;
      }
    >();

    let acceptedCount = 0;
    let rejectedCount = 0;
    const observedAtMs = snapshot.observedAt.getTime();

    for (const beaconId of allBeaconIds) {
      const reading = readingByBeacon.get(beaconId);
      if (!reading) {
        // Bu beacon bu turda telefonun taramasinda hic gorulmedi (sentinel
        // bile degil, satir hic yok). Grace-fallback pass'i asagida ele alir.
        continue;
      }

      const previous = previousStates.get(beaconId) ?? null;

      // Katman 1.1 - sentinel kapisi. rssi >= 0 bir olcum DEGIL, "deger
      // alinamadi" sinyalidir; pencereye de girmez, cunku medyani tamamen
      // bozar (0 ile -70 arasindaki fark gercek bir sinyal farki degildir).
      if (!isValidRssi(reading.rssi)) {
        rejectedCount += 1;
        readingTrace.set(beaconId, {
          beaconId,
          emaValue: previous?.emaValue ?? reading.rssi,
          rawAccepted: false,
        });
        continue;
      }

      // Katman 1.3 - FIFO pencere. Pencere HER ZAMAN, KOSULSUZ kayar.
      //
      // Bu kritik: pencereye yalnizca "kabul edilen" okumalar alinsaydi,
      // pencere homojenlestikce MAD kuculur, kabul bandi daralir ve
      // katilimci gercekten hareket ettiginde tum yeni okumalar reddedilip
      // pencere hic guncellenmezdi - referans eski konumda kalici olarak
      // kilitlenirdi (canli testte dogrulandi: pencere donup o beacon
      // TTL boyunca karar hesabindan tamamen dusuyordu).
      //
      // Pencerenin ham gecmis olmasi guvenli: medyan, 5 elemanli bir
      // pencerede tek bir uc degere zaten dayaniklidir. Tek seferlik
      // sicrama yine elenir, SUREKLI bir degisim ise pencere dolunca
      // (hampelWindowSize olcum) kendiliginden yeni gercekligi ogrenir.
      const window = [...(previous?.recentRssi ?? []), reading.rssi].slice(
        -context.hampelWindowSize,
      );

      // Katman 1.2 - Hampel. Artik yalnizca "bu okuma EMA'ya beslensin mi"
      // sorusunu cevaplar; pencereye alinma karari degildir.
      const isOutlier = isHampelOutlier(
        reading.rssi,
        previous?.recentRssi ?? [],
        context.hampelK,
        context.hampelWindowSize,
      );

      if (isOutlier) {
        rejectedCount += 1;
        // EMA'ya beslenmez ve bu snapshot icin "gorulmedi" sayilir
        // (emaByBeacon'a girmez), ama pencere yine de kaydi. lastAcceptedAt
        // DEGISMEZ - bu okuma gercekten kabul edilmedi.
        nextStates.set(beaconId, {
          emaValue: previous?.emaValue ?? reading.rssi,
          recentRssi: window,
          updatedAt: snapshot.observedAt.toISOString(),
          lastAcceptedAt:
            previous?.lastAcceptedAt ?? snapshot.observedAt.toISOString(),
        });
        readingTrace.set(beaconId, {
          beaconId,
          emaValue: previous?.emaValue ?? reading.rssi,
          rawAccepted: false,
        });
        continue;
      }

      acceptedCount += 1;

      // Katman 2 - EMA.
      const ema = nextEma(
        previous?.emaValue ?? null,
        reading.rssi,
        context.emaAlpha,
      );

      nextStates.set(beaconId, {
        emaValue: ema,
        recentRssi: window,
        updatedAt: snapshot.observedAt.toISOString(),
        lastAcceptedAt: snapshot.observedAt.toISOString(),
      });
      emaByBeacon.set(beaconId, ema);
      readingTrace.set(beaconId, {
        beaconId,
        emaValue: ema,
        rawAccepted: true,
      });
    }

    // Grace-fallback pass (Faz G saha testinde bulunan "isinlanma" hatasinin
    // duzeltmesi): bu turda taze bir EMA alamayan (sentinel, Hampel-reddi
    // veya taramada hic gorunmeme) bir beacon, son GERCEKTEN gecerli
    // okumasindan bu yana `staleGraceSeconds` saniyeden az gectiyse, o eski
    // EMA'siyla (SONMEDEN, aynen) hala salon ortalamasina ve softmax
    // yarismasina dahil edilir. Boylece tek bir beacon'un 1-2 turluk gecici
    // dususu, o salonu aninda "aday disi" birakip rakip salonu "tek aday"
    // yapmiyor - rakip, gercekten daha guclu degilse kazanamiyor.
    //
    // previousStates bu turun yazmalarindan ONCE yuklendigi icin burada
    // guvenle kullanilir; henuz taze veri almis beacon'lar zaten
    // emaByBeacon'da olduklarindan atlaniyor.
    for (const beaconId of allBeaconIds) {
      if (emaByBeacon.has(beaconId)) continue;

      const previous = previousStates.get(beaconId);
      if (!previous?.lastAcceptedAt) continue;

      const lastAcceptedMs = Date.parse(previous.lastAcceptedAt);
      if (Number.isNaN(lastAcceptedMs)) continue;

      const ageMs = observedAtMs - lastAcceptedMs;
      const graceMs = context.staleGraceSeconds * 1000;
      // graceMs sayisal degilse (beklenmez ama savunmaci) "sonsuz grace"
      // yerine guvenli varsayilan olarak grace UYGULANMAZ - NaN ile
      // karsilastirma her zaman false donup yanlislikla sinirsiz grace
      // vermesin diye acikca kontrol ediliyor.
      if (!Number.isFinite(graceMs) || ageMs < 0 || ageMs > graceMs) continue;

      emaByBeacon.set(beaconId, previous.emaValue);
      readingTrace.set(beaconId, {
        beaconId,
        emaValue: previous.emaValue,
        rawAccepted: false,
        stale: true,
      });
    }

    // Redis erisilemezse bu cagrilar sessizce basarisiz olur ve sistem
    // yumusatmasiz calismaya devam eder (bkz. BeaconSignalStore).
    await this.signalStore.saveMany(userId, nextStates);
    await this.signalStore.bumpCounters(userId, acceptedCount, rejectedCount);

    // Katman 3 - salon ici uzamsal birlestirme. Ortalamaya taze VEYA grace
    // suresi icinde donmus (stale) EMA'si olan beacon'lar girer.
    const hallAccumulator = new Map<
      string,
      { sum: number; count: number; threshold: number }
    >();

    for (const [beaconId, ema] of emaByBeacon) {
      const assignment = context.beaconToHall.get(beaconId);
      if (!assignment) continue;

      const entry = hallAccumulator.get(assignment.hallId) ?? {
        sum: 0,
        count: 0,
        threshold: assignment.hallThreshold,
      };
      entry.sum += ema;
      entry.count += 1;
      hallAccumulator.set(assignment.hallId, entry);
    }

    // Karar izi icin salon basina TUM beacon'lar (elenenler dahil) tutulur:
    // "bu salonun hangi beacon'i neden hesaba katilmadi" sorusu ancak boyle
    // cevaplanabilir. Ortalamayi etkilemezler, yalnizca trace'te gorunurler.
    const traceBeaconsByHall = new Map<string, string[]>();
    for (const [beaconId] of readingTrace) {
      const assignment = context.beaconToHall.get(beaconId);
      if (!assignment) continue;

      const list = traceBeaconsByHall.get(assignment.hallId) ?? [];
      if (!list.includes(beaconId)) {
        list.push(beaconId);
      }
      traceBeaconsByHall.set(assignment.hallId, list);
    }

    if (hallAccumulator.size === 0) {
      return emptyDecision(rejectedCount);
    }

    const means = new Map<string, number>();
    for (const [hallId, entry] of hallAccumulator) {
      means.set(hallId, entry.sum / entry.count);
    }

    // Katman 4 - salonlar arasi karsilastirma.
    const percentages = softmaxPercentages(
      means,
      context.confidenceTemperature,
    );

    const scores: HallScore[] = [...hallAccumulator].map(([hallId, entry]) => {
      const mean = means.get(hallId) as number;
      return {
        hallId,
        emaAverage: mean,
        percentage: percentages.get(hallId) ?? 0,
        passesThreshold: mean >= entry.threshold,
        beaconReadings: (traceBeaconsByHall.get(hallId) ?? [])
          .map((beaconId) => readingTrace.get(beaconId))
          .filter((entry) => entry !== undefined),
      };
    });

    // Deterministik siralama: yuzde azalan, esitlikte hallId'ye gore.
    // Acik salonun onceliklenmesi ayrica ele alinmiyor - bunu Katman 5'teki
    // kalma histerezisi zaten sagliyor (acik ziyaret once kontrol ediliyor).
    scores.sort(
      (a, b) => b.percentage - a.percentage || a.hallId.localeCompare(b.hallId),
    );

    // Nihai aday: en yuksek yuzdeye sahip VE kendi salon esigini gecen salon.
    const passing = scores.filter((score) => score.passesThreshold);
    const topHallId = passing.length > 0 ? passing[0].hallId : null;
    const topPercentage = passing.length > 0 ? passing[0].percentage : 0;

    // Belirsizlik yalnizca ESIGI GECEN salonlar arasinda aranir. Aksi halde
    // koridorda duran (iki salonu da zayif goren) bir katilimci "belirsiz"
    // sayilir, cikis sayaci donar ve acik ziyareti kapanmazdi.
    const runnerUpGapPct =
      passing.length >= 2 ? passing[0].percentage - passing[1].percentage : 100;
    const isAmbiguous =
      passing.length >= 2 && runnerUpGapPct < context.ambiguityMarginPct;

    return {
      scores,
      topHallId,
      topPercentage,
      runnerUpGapPct,
      isAmbiguous,
      rejectedOutliers: rejectedCount,
    };
  }

  // Katman 5'in yazma tarafi. Karar mantigi presence-transition.ts icinde
  // (saf ve test edilebilir); burada yalnizca uretilen efektler islenir.
  private async applyDecision(
    userId: string,
    observedAt: Date,
    decision: Decision,
    context: ProcessingContext,
  ): Promise<void> {
    const trace = buildDecisionTrace(decision);

    await this.prisma.$transaction(async (tx) => {
      const state =
        (await tx.userPresenceState.findUnique({ where: { userId } })) ??
        (await tx.userPresenceState.create({ data: { userId } }));

      const openVisit = state.openHallVisitId
        ? await tx.hallVisit.findUnique({
            where: { id: state.openHallVisitId },
          })
        : null;

      const result = transition({
        state: {
          candidateHallId: state.candidateHallId,
          candidateStreak: state.candidateStreak,
          nonQualifyingStreak: state.nonQualifyingStreak,
        },
        openVisit: openVisit
          ? {
              id: openVisit.id,
              hallId: openVisit.hallId,
              lastConfirmedAt: openVisit.lastConfirmedAt,
            }
          : null,
        decision,
        config: {
          entryProbabilityThreshold: context.entryProbabilityThreshold,
          exitProbabilityThreshold: context.exitProbabilityThreshold,
        },
        observedAt,
      });

      let openHallVisitId = state.openHallVisitId;

      for (const effect of result.effects) {
        openHallVisitId = await this.applyEffect(
          tx,
          userId,
          effect,
          trace,
          openHallVisitId,
        );
      }

      await tx.userPresenceState.update({
        where: { userId },
        data: { ...result.nextState, openHallVisitId },
      });
    });
  }

  private async applyEffect(
    tx: Prisma.TransactionClient,
    userId: string,
    effect: TransitionEffect,
    trace: Prisma.InputJsonValue,
    openHallVisitId: string | null,
  ): Promise<string | null> {
    switch (effect.kind) {
      case 'touch-last-confirmed':
        await tx.hallVisit.update({
          where: { id: effect.visitId },
          data: { lastConfirmedAt: effect.observedAt },
        });
        return openHallVisitId;

      case 'close-visit':
        await tx.hallVisit.update({
          where: { id: effect.visitId },
          data: { isOpen: false, endedAt: effect.endedAt },
        });
        await tx.attendanceEvent.create({
          data: {
            userId,
            hallId: effect.hallId,
            type: AttendanceEventType.EXIT,
            occurredAt: effect.endedAt,
            confidenceScore: effect.percentage,
            decisionTrace: trace,
            algorithmVersion: ALGORITHM_VERSION,
          },
        });
        return null;

      case 'open-visit': {
        const visit = await tx.hallVisit.create({
          data: {
            userId,
            hallId: effect.hallId,
            startedAt: effect.startedAt,
            lastConfirmedAt: effect.startedAt,
            confidenceLevel: confidenceLevelFromPercentage(effect.percentage),
            algorithmVersion: ALGORITHM_VERSION,
          },
        });
        await tx.attendanceEvent.create({
          data: {
            userId,
            hallId: effect.hallId,
            type: AttendanceEventType.ENTRY,
            occurredAt: effect.startedAt,
            confidenceScore: effect.percentage,
            decisionTrace: trace,
            algorithmVersion: ALGORITHM_VERSION,
          },
        });
        return visit.id;
      }
    }
  }
}

function emptyDecision(rejectedOutliers: number): Decision {
  return {
    scores: [],
    topHallId: null,
    topPercentage: 0,
    runnerUpGapPct: 100,
    isAmbiguous: false,
    rejectedOutliers,
  };
}

// "Bu karar neden verildi" sorusuna cevap verebilmek icin saklanan ozet.
// Kesin bir sema zorunlu degil; amaci saha testinde yanlis salon secimlerini
// geriye donuk aciklayabilmek.
function buildDecisionTrace(decision: Decision): Prisma.InputJsonValue {
  return {
    candidates: decision.scores.map((score) => ({
      hallId: score.hallId,
      percentage: Number(score.percentage.toFixed(2)),
      emaAverage: Number(score.emaAverage.toFixed(2)),
      passesThreshold: score.passesThreshold,
      beaconReadings: score.beaconReadings.map((reading) => ({
        beaconId: reading.beaconId,
        emaValue: Number(reading.emaValue.toFixed(2)),
        rawAccepted: reading.rawAccepted,
        ...(reading.stale ? { stale: true } : {}),
      })),
    })),
    runnerUpGapPct: Number(decision.runnerUpGapPct.toFixed(2)),
    rejectedOutliers: decision.rejectedOutliers,
    algorithmVersion: ALGORITHM_VERSION,
  };
}
