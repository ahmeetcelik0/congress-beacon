import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HallVisitsQueryDto } from './dto/hall-visits-query.dto';
import { OccupancySeriesQueryDto } from './dto/occupancy-series-query.dto';

@Injectable()
export class AttendanceQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(congressId: string) {
    const halls = await this.prisma.hall.findMany({ where: { congressId } });

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

    return {
      activeHalls: halls.length,
      currentlyInsideTotal: openVisits.length,
      hallOccupancy,
      participantsSeenToday: participantsToday.length,
      lastObservationAt: lastObservation?.serverReceivedAt ?? null,
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

    return {
      items: items.map((visit) => ({
        id: visit.id,
        userFirstName: visit.user.firstName,
        userLastName: visit.user.lastName,
        hallId: visit.hallId,
        hallName: visit.hall.name,
        startedAt: visit.startedAt,
        endedAt: visit.endedAt,
        isOpen: visit.isOpen,
        confidenceLevel: visit.confidenceLevel,
        algorithmVersion: visit.algorithmVersion,
      })),
      total,
      page,
      pageSize,
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
      where: { congressId: query.congressId, ...(query.hallId ? { id: query.hallId } : {}) },
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
    const points: { bucketStart: string; values: Record<string, number> }[] = [];

    for (let bucketStart = from.getTime(); bucketStart < to.getTime(); bucketStart += bucketMs) {
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
