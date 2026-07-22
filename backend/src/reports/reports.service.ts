import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceQueryService } from '../attendance/attendance-query.service';
import { HallVisitsQueryDto } from '../attendance/dto/hall-visits-query.dto';

const CSV_EXPORT_MAX_ROWS = 5000;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceQueryService: AttendanceQueryService,
  ) {}

  async getDataQuality(congressId: string) {
    const [totalObservations, matchedObservations] = await Promise.all([
      this.prisma.beaconObservation.count({ where: { congressId } }),
      this.prisma.beaconObservation.count({
        where: { congressId, beaconId: { not: null } },
      }),
    ]);
    const unmatchedObservations = totalObservations - matchedObservations;

    return {
      totalObservations,
      matchedObservations,
      unmatchedObservations,
      matchedRatio:
        totalObservations > 0 ? matchedObservations / totalObservations : null,
    };
  }

  async getBeaconHealth(congressId: string) {
    const beacons = await this.prisma.beacon.findMany({
      where: { congressId },
      include: {
        hallBeacons: { where: { isActive: true }, include: { hall: true } },
      },
    });

    const [observationStats, rssiStats, userStats] = await Promise.all([
      this.prisma.beaconObservation.groupBy({
        by: ['beaconId'],
        where: { congressId, beaconId: { not: null } },
        _max: { serverReceivedAt: true },
        _count: { _all: true },
      }),
      // Ortalama RSSI'da sentinel (rssi >= 0) okumalar haric tutulur; dahil
      // edilseler ortalamayi gercekte olmadigi kadar "guclu" gosterirlerdi.
      this.prisma.beaconObservation.groupBy({
        by: ['beaconId'],
        where: { congressId, beaconId: { not: null }, rssi: { lt: 0 } },
        _avg: { rssi: true },
      }),
      // Bir beacon'i kac FARKLI katilimci gordu - kapsama alaninin gostergesi.
      this.prisma.beaconObservation.groupBy({
        by: ['beaconId', 'userId'],
        where: { congressId, beaconId: { not: null } },
      }),
    ]);

    const statsMap = new Map(
      observationStats.map((row) => [row.beaconId, row]),
    );
    const rssiMap = new Map(
      rssiStats.map((row) => [row.beaconId, row._avg.rssi]),
    );
    const usersSeenMap = new Map<string, number>();
    for (const row of userStats) {
      if (!row.beaconId) continue;
      usersSeenMap.set(row.beaconId, (usersSeenMap.get(row.beaconId) ?? 0) + 1);
    }

    return beacons.map((beacon) => {
      const stats = statsMap.get(beacon.id);
      const activeAssignment = beacon.hallBeacons[0] ?? null;

      return {
        beaconId: beacon.id,
        label: beacon.label,
        major: beacon.major,
        minor: beacon.minor,
        assignedHallName: activeAssignment?.hall.name ?? null,
        isAssigned: activeAssignment !== null,
        observationCount: stats?._count._all ?? 0,
        lastSeenAt: stats?._max.serverReceivedAt ?? null,
        averageRssi: rssiMap.get(beacon.id) ?? null,
        usersSeenCount: usersSeenMap.get(beacon.id) ?? 0,
      };
    });
  }

  async getHallVisitsCsv(query: HallVisitsQueryDto): Promise<string> {
    const { items } = await this.attendanceQueryService.getHallVisits({
      ...query,
      page: 1,
      pageSize: CSV_EXPORT_MAX_ROWS,
    });

    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const header = [
      'Katilimci',
      'Salon',
      'Giris',
      'Cikis',
      'Sure (dk)',
      'Guven',
      'Durum',
    ].join(',');

    const rows = items.map((visit) => {
      const durationMinutes = Math.round(
        ((visit.endedAt ? new Date(visit.endedAt).getTime() : Date.now()) -
          new Date(visit.startedAt).getTime()) /
          60000,
      );

      return [
        escape(`${visit.userFirstName} ${visit.userLastName}`),
        escape(visit.hallName),
        visit.startedAt.toISOString(),
        visit.endedAt ? visit.endedAt.toISOString() : '',
        String(durationMinutes),
        visit.confidenceLevel ?? '',
        visit.isOpen ? 'icerde' : 'cikti',
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }
}
