import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceQueryService } from '../attendance/attendance-query.service';
import { HallVisitsQueryDto } from '../attendance/dto/hall-visits-query.dto';
import { NotificationStatus } from '../../generated/prisma/client';

const CSV_EXPORT_MAX_ROWS = 5000;
// Faz 9: panelde "son gonderimler" listesi icin ust sinir - sinirsiz
// buyumeyi onlemek amacli, sayfalama bu kapsamda YOK (kucuk bir liste
// yeterli, bkz. Faz 9 talimati §6 "kucuk bir ekleme").
const RECENT_NOTIFICATIONS_LIMIT = 20;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceQueryService: AttendanceQueryService,
  ) {}

  async getDataQuality(congressId: string) {
    const [totalObservations, matchedObservations, congress, unmatchedGroups] =
      await Promise.all([
        this.prisma.beaconObservation.count({ where: { congressId } }),
        this.prisma.beaconObservation.count({
          where: { congressId, beaconId: { not: null } },
        }),
        this.prisma.congress.findUnique({
          where: { id: congressId },
          select: { beaconUuid: true },
        }),
        // "Veri geliyor ama hicbir beacon'a baglanmiyor" durumunun sebebini
        // dogrudan gosterir - en cok gorulen 10 eslesmeyen UUID/major/minor
        // (bkz. Faz 6.2 talimati §2, sahada 6+ dakika teshis edilemeyen
        // durumun bir sonraki sefer dakikalar icinde gorulur olmasi icin).
        this.prisma.beaconObservation.groupBy({
          by: ['uuid', 'major', 'minor'],
          where: { congressId, beaconId: null },
          _count: { _all: true },
        }),
      ]);
    const unmatchedObservations = totalObservations - matchedObservations;

    const topUnmatchedBeacons = unmatchedGroups
      .map((group) => ({
        uuid: group.uuid,
        major: group.major,
        minor: group.minor,
        count: group._count._all,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Kongre duzeyinde tutarlilik uyarisi: bu kongreye ait ama kongrenin
    // kendi beaconUuid'iyle eslesmeyen bir Beacon kaydi varsa (bkz.
    // beacon.service.ts artik bunu YENI kayitlar icin engelliyor, ama eski/
    // elle DB'ye yazilmis veri hala boyle olabilir), veya eslesmeyen gozlem
    // orani belirgin sekilde yuksekse (>= %20, en az 20 gozlemlik ornekte -
    // az veri var kucuk oranlar yanlis alarm verir) acikca bildirilir.
    const mismatchedBeaconCount = congress
      ? await this.prisma.beacon.count({
          where: {
            congressId,
            NOT: { uuid: congress.beaconUuid.toUpperCase() },
          },
        })
      : 0;
    const unmatchedRatio =
      totalObservations > 0 ? unmatchedObservations / totalObservations : 0;
    const highUnmatchedRatio = totalObservations >= 20 && unmatchedRatio >= 0.2;

    const consistencyWarning =
      mismatchedBeaconCount > 0
        ? `Bu kongrede, kongrenin kendi UUID'siyle (${congress?.beaconUuid}) ` +
          `eslesmeyen ${mismatchedBeaconCount} beacon kaydi var - bu ` +
          "beacon'lardan gelen gozlemler hicbir salona baglanamaz."
        : highUnmatchedRatio
          ? `Gozlemlerin %${Math.round(unmatchedRatio * 100)}'i hicbir ` +
            "beacon'a eslesmiyor - asagidaki UUID/major/minor kirilimini " +
            'kontrol edin.'
          : null;

    return {
      totalObservations,
      matchedObservations,
      unmatchedObservations,
      matchedRatio:
        totalObservations > 0 ? matchedObservations / totalObservations : null,
      topUnmatchedBeacons,
      mismatchedBeaconCount,
      consistencyWarning,
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

  // Faz 9: kongre bazinda gonderilen/acilan bildirim sayisi + son
  // gonderimler listesi (bkz. Faz 9 talimati §6). `NotificationLog.
  // congressId` dogrudan filtrelenir - birlestirilmis bildirimlerde
  // `sessionId` NULL olabildigi icin session iliskisi UZERINDEN
  // filtrelemek GUVENILMEZ olurdu (bkz. schema.prisma yorumu).
  async getNotificationSummary(congressId: string) {
    const [sentCount, openedCount, failedCount, skippedCount, recent] =
      await Promise.all([
        this.prisma.notificationLog.count({
          where: { congressId, status: NotificationStatus.SENT },
        }),
        this.prisma.notificationLog.count({
          where: { congressId, openedAt: { not: null } },
        }),
        this.prisma.notificationLog.count({
          where: { congressId, status: NotificationStatus.FAILED },
        }),
        this.prisma.notificationLog.count({
          where: { congressId, status: NotificationStatus.SKIPPED },
        }),
        this.prisma.notificationLog.findMany({
          where: { congressId },
          orderBy: { sentAt: 'desc' },
          take: RECENT_NOTIFICATIONS_LIMIT,
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        }),
      ]);

    return {
      sentCount,
      openedCount,
      failedCount,
      skippedCount,
      openedRatio: sentCount > 0 ? openedCount / sentCount : null,
      recent: recent.map((log) => ({
        id: log.id,
        title: log.title,
        body: log.body,
        status: log.status,
        sentAt: log.sentAt,
        openedAt: log.openedAt,
        userName: `${log.user.firstName} ${log.user.lastName}`,
      })),
    };
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
