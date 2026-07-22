import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceEventType } from '../../generated/prisma/client';
import { HallVisitsQueryDto } from './dto/hall-visits-query.dto';
import { OccupancySeriesQueryDto } from './dto/occupancy-series-query.dto';

// Guven skoru yalnizca v3'te 0-100 yuzdesi; v2 kayitlari ayni alanda ham dB
// marjini tasiyor. Ortalamalarda ikisini karistirmamak icin her zaman bu
// surume filtre uygulanir.
const PERCENTAGE_ALGORITHM_VERSION = 'v3';

function median(sortedValues: number[]): number {
  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 !== 0
    ? sortedValues[mid]
    : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
}

@Injectable()
export class AttendanceQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(congressId: string) {
    const halls = await this.prisma.hall.findMany({ where: { congressId } });

    // isOpen:true olan ziyaretler artik gercekten acik demektir - bayat olanlar
    // StaleVisitSweepService (BullMQ repeatable job) tarafindan periyodik olarak
    // gercekten kapatiliyor, burada ekstra bir zaman filtresine gerek yok.
    const openVisits = await this.prisma.hallVisit.findMany({
      where: { isOpen: true, hall: { congressId } },
      select: { hallId: true },
    });

    const occupancyMap = new Map<string, number>();
    for (const visit of openVisits) {
      occupancyMap.set(visit.hallId, (occupancyMap.get(visit.hallId) ?? 0) + 1);
    }

    const hallOccupancy = halls.map((hall) => ({
      hallId: hall.id,
      hallName: hall.name,
      count: occupancyMap.get(hall.id) ?? 0,
    }));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const participantsToday = await this.prisma.hallVisit.findMany({
      where: { hall: { congressId }, startedAt: { gte: todayStart } },
      select: { userId: true },
      distinct: ['userId'],
    });

    const lastObservation = await this.prisma.beaconObservation.findFirst({
      where: { congressId },
      orderBy: { serverReceivedAt: 'desc' },
      select: { serverReceivedAt: true },
    });

    const closedVisits = await this.prisma.hallVisit.findMany({
      where: { hall: { congressId }, endedAt: { not: null } },
      select: { hallId: true, startedAt: true, endedAt: true },
    });

    const durationsByHall = new Map<string, number[]>();
    for (const visit of closedVisits) {
      const minutes =
        (visit.endedAt!.getTime() - visit.startedAt.getTime()) / 60000;
      const list = durationsByHall.get(visit.hallId) ?? [];
      list.push(minutes);
      durationsByHall.set(visit.hallId, list);
    }

    // Salon bazli ortalama guven skoru: o salonun beacon yerlesiminin ne kadar
    // "net" calistiginin gostergesi.
    const confidenceByHall = await this.prisma.attendanceEvent.groupBy({
      by: ['hallId'],
      where: {
        hall: { congressId },
        type: AttendanceEventType.ENTRY,
        algorithmVersion: PERCENTAGE_ALGORITHM_VERSION,
      },
      _avg: { confidenceScore: true },
    });
    const confidenceMap = new Map(
      confidenceByHall.map((row) => [row.hallId, row._avg.confidenceScore]),
    );

    const durationStats = halls.map((hall) => {
      const durations = (durationsByHall.get(hall.id) ?? []).sort(
        (a, b) => a - b,
      );
      return {
        hallId: hall.id,
        hallName: hall.name,
        visitCount: durations.length,
        averageMinutes:
          durations.length > 0
            ? durations.reduce((sum, d) => sum + d, 0) / durations.length
            : null,
        medianMinutes: durations.length > 0 ? median(durations) : null,
        averageConfidenceScore: confidenceMap.get(hall.id) ?? null,
      };
    });

    return {
      activeHalls: halls.length,
      currentlyInsideTotal: openVisits.length,
      hallOccupancy,
      participantsSeenToday: participantsToday.length,
      lastObservationAt: lastObservation?.serverReceivedAt ?? null,
      durationStats,
    };
  }

  async getHallVisits(query: HallVisitsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      hall: { congressId: query.congressId },
      ...(query.hallId ? { hallId: query.hallId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.isOpen !== undefined ? { isOpen: query.isOpen } : {}),
      ...(query.search
        ? {
            user: {
              OR: [
                { firstName: { contains: query.search } },
                { lastName: { contains: query.search } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.hallVisit.findMany({
        where,
        include: { user: true, hall: true },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.hallVisit.count({ where }),
    ]);

    // Guven YUZDESI HallVisit'te degil, girisi ureten AttendanceEvent'te
    // duruyor (ikisi ayni observedAt ile uretiliyor). Sayfadaki ziyaretlerin
    // giris event'lerini tek sorguda cekip bellekte eslestiriyoruz - satir
    // basina ayri sorgu yok.
    const entryEvents =
      items.length > 0
        ? await this.prisma.attendanceEvent.findMany({
            where: {
              type: AttendanceEventType.ENTRY,
              algorithmVersion: PERCENTAGE_ALGORITHM_VERSION,
              userId: { in: items.map((visit) => visit.userId) },
              occurredAt: { in: items.map((visit) => visit.startedAt) },
            },
            select: {
              userId: true,
              hallId: true,
              occurredAt: true,
              confidenceScore: true,
            },
          })
        : [];

    const scoreKey = (userId: string, hallId: string, at: Date) =>
      `${userId}|${hallId}|${at.getTime()}`;
    const scoreMap = new Map(
      entryEvents.map((event) => [
        scoreKey(event.userId, event.hallId, event.occurredAt),
        event.confidenceScore,
      ]),
    );

    return {
      items: items.map((visit) => ({
        id: visit.id,
        userId: visit.userId,
        userFirstName: visit.user.firstName,
        userLastName: visit.user.lastName,
        hallId: visit.hallId,
        hallName: visit.hall.name,
        startedAt: visit.startedAt,
        endedAt: visit.endedAt,
        isOpen: visit.isOpen,
        confidenceLevel: visit.confidenceLevel,
        confidenceScore:
          scoreMap.get(scoreKey(visit.userId, visit.hallId, visit.startedAt)) ??
          null,
        algorithmVersion: visit.algorithmVersion,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getUserSummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!user) {
      throw new NotFoundException(`Kullanici ${userId} bulunamadi`);
    }

    const visits = await this.prisma.hallVisit.findMany({
      where: { userId },
      select: {
        hallId: true,
        startedAt: true,
        endedAt: true,
        isOpen: true,
        hall: { select: { name: true } },
      },
      orderBy: { startedAt: 'asc' },
    });

    const now = Date.now();
    let totalMinutes = 0;
    const hallIds = new Set<string>();
    for (const visit of visits) {
      // Acik ziyaretlerde "su ana kadar" sayilir; kapali ziyaretlerde
      // endedAt son dogrulanmis andir.
      const end = visit.endedAt ? visit.endedAt.getTime() : now;
      totalMinutes += Math.max(0, (end - visit.startedAt.getTime()) / 60000);
      hallIds.add(visit.hallId);
    }

    const [entryCount, exitCount, confidence, observationRange] =
      await Promise.all([
        this.prisma.attendanceEvent.count({
          where: { userId, type: AttendanceEventType.ENTRY },
        }),
        this.prisma.attendanceEvent.count({
          where: { userId, type: AttendanceEventType.EXIT },
        }),
        this.prisma.attendanceEvent.aggregate({
          where: {
            userId,
            type: AttendanceEventType.ENTRY,
            algorithmVersion: PERCENTAGE_ALGORITHM_VERSION,
          },
          _avg: { confidenceScore: true },
        }),
        this.prisma.beaconObservation.aggregate({
          where: { userId },
          _min: { observedAt: true },
          _max: { observedAt: true },
        }),
      ]);

    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      totalMinutes,
      visitCount: visits.length,
      distinctHallCount: hallIds.size,
      entryCount,
      exitCount,
      averageConfidenceScore: confidence._avg.confidenceScore,
      firstSeenAt: observationRange._min.observedAt,
      lastSeenAt: observationRange._max.observedAt,
      currentlyInside: visits.some((visit) => visit.isOpen),
    };
  }

  // Bir ziyaretin "neden bu karar verildi" izi.
  //
  // HallVisit ile AttendanceEvent arasinda yabanci anahtar YOK; ikisi
  // AttendanceProcessingService tarafindan ayni anda ve ayni zaman damgasiyla
  // uretiliyor (giriste occurredAt = startedAt, cikista occurredAt = endedAt),
  // bu yuzden eslestirme bu uclu uzerinden yapiliyor. Ham veriye ya da karar
  // kayitlarina yeni kolon eklemeye gerek kalmiyor.
  async getVisitTrace(visitId: string) {
    const visit = await this.prisma.hallVisit.findUnique({
      where: { id: visitId },
      include: { hall: { select: { name: true } } },
    });
    if (!visit) {
      throw new NotFoundException(`Ziyaret ${visitId} bulunamadi`);
    }

    const [entryEvent, exitEvent] = await Promise.all([
      this.prisma.attendanceEvent.findFirst({
        where: {
          userId: visit.userId,
          hallId: visit.hallId,
          type: AttendanceEventType.ENTRY,
          occurredAt: visit.startedAt,
        },
        orderBy: { createdAt: 'desc' },
      }),
      visit.endedAt
        ? this.prisma.attendanceEvent.findFirst({
            where: {
              userId: visit.userId,
              hallId: visit.hallId,
              type: AttendanceEventType.EXIT,
              occurredAt: visit.endedAt,
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve(null),
    ]);

    return {
      visitId: visit.id,
      userId: visit.userId,
      hallId: visit.hallId,
      hallName: visit.hall.name,
      startedAt: visit.startedAt,
      endedAt: visit.endedAt,
      isOpen: visit.isOpen,
      confidenceLevel: visit.confidenceLevel,
      algorithmVersion: visit.algorithmVersion,
      entry: entryEvent
        ? {
            occurredAt: entryEvent.occurredAt,
            confidenceScore: entryEvent.confidenceScore,
            decisionTrace: entryEvent.decisionTrace,
          }
        : null,
      exit: exitEvent
        ? {
            occurredAt: exitEvent.occurredAt,
            confidenceScore: exitEvent.confidenceScore,
            decisionTrace: exitEvent.decisionTrace,
          }
        : null,
    };
  }

  async getOccupancySeries(query: OccupancySeriesQueryDto) {
    const bucketMinutes = query.bucketMinutes ?? 15;

    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : (() => {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          return start;
        })();

    const halls = await this.prisma.hall.findMany({
      where: {
        congressId: query.congressId,
        ...(query.hallId ? { id: query.hallId } : {}),
      },
    });

    const visits = await this.prisma.hallVisit.findMany({
      where: {
        hall: { congressId: query.congressId },
        ...(query.hallId ? { hallId: query.hallId } : {}),
        startedAt: { lt: to },
        OR: [{ endedAt: null }, { endedAt: { gt: from } }],
      },
      select: { hallId: true, startedAt: true, endedAt: true },
    });

    const bucketMs = bucketMinutes * 60 * 1000;
    const points: { bucketStart: string; values: Record<string, number> }[] =
      [];

    for (
      let bucketStart = from.getTime();
      bucketStart < to.getTime();
      bucketStart += bucketMs
    ) {
      const bucketEnd = bucketStart + bucketMs;
      const values: Record<string, number> = {};

      for (const hall of halls) {
        values[hall.id] = 0;
      }

      for (const visit of visits) {
        const start = visit.startedAt.getTime();
        const end = visit.endedAt ? visit.endedAt.getTime() : Infinity;
        if (start < bucketEnd && end > bucketStart) {
          values[visit.hallId] = (values[visit.hallId] ?? 0) + 1;
        }
      }

      points.push({ bucketStart: new Date(bucketStart).toISOString(), values });
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      bucketMinutes,
      halls: halls.map((hall) => ({ hallId: hall.id, hallName: hall.name })),
      points,
    };
  }
}
