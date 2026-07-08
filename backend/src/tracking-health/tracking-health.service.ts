import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_AFTER_MS = 2 * 60 * 1000;
const RECENT_AFTER_MS = 10 * 60 * 1000;

export type TrackingHealthStatus = 'aktif' | 'yakin_zamanda' | 'veri_yok';

@Injectable()
export class TrackingHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrackingHealth(congressId: string) {
    const users = await this.prisma.user.findMany({
      where: { congressId, role: 'PARTICIPANT' },
      include: {
        devices: { orderBy: { updatedAt: 'desc' }, take: 1 },
      },
    });

    const lastObservations = await this.prisma.beaconObservation.groupBy({
      by: ['userId'],
      where: { congressId },
      _max: { serverReceivedAt: true },
    });
    const lastSeenMap = new Map(
      lastObservations.map((row) => [row.userId, row._max.serverReceivedAt]),
    );

    const now = Date.now();

    const items = users.map((user) => {
      const lastObservationAt = lastSeenMap.get(user.id) ?? null;
      const device = user.devices[0] ?? null;
      const diffMs = lastObservationAt
        ? now - lastObservationAt.getTime()
        : null;

      let status: TrackingHealthStatus;
      if (diffMs === null || diffMs > RECENT_AFTER_MS) {
        status = 'veri_yok';
      } else if (diffMs <= ACTIVE_AFTER_MS) {
        status = 'aktif';
      } else {
        status = 'yakin_zamanda';
      }

      return {
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        devicePlatform: device?.platform ?? null,
        deviceAppVersion: device?.appVersion ?? null,
        lastObservationAt,
        status,
      };
    });

    const statusOrder: Record<TrackingHealthStatus, number> = {
      aktif: 0,
      yakin_zamanda: 1,
      veri_yok: 2,
    };
    items.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    return {
      items,
      summary: {
        aktif: items.filter((i) => i.status === 'aktif').length,
        yakinZamanda: items.filter((i) => i.status === 'yakin_zamanda').length,
        veriYok: items.filter((i) => i.status === 'veri_yok').length,
      },
    };
  }
}
