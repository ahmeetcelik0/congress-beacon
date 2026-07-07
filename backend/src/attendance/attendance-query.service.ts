import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HallVisitsQueryDto } from './dto/hall-visits-query.dto';

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
}
