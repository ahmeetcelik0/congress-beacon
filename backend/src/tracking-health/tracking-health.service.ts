import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceStatus } from '../../generated/prisma/client';
import { BeaconSignalStore } from '../attendance/signal/beacon-signal-store';

const ACTIVE_AFTER_MS = 2 * 60 * 1000;
const RECENT_AFTER_MS = 10 * 60 * 1000;

export type TrackingHealthStatus = 'aktif' | 'yakin_zamanda' | 'veri_yok';

@Injectable()
export class TrackingHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signalStore: BeaconSignalStore,
  ) {}

  async getTrackingHealth(congressId: string) {
    const users = await this.prisma.user.findMany({
      // Faz 1: User artik tek bir kongreye kilitli degil - kongre katilimi
      // CongressRegistration uzerinden kontrol edilir.
      where: {
        role: 'PARTICIPANT',
        registrations: { some: { congressId, isActive: true } },
      },
      include: {
        devices: { orderBy: { updatedAt: 'desc' }, take: 1 },
        presenceState: {
          select: {
            currentStatus: true,
            openHallVisit: { select: { hall: { select: { name: true } } } },
          },
        },
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

    // Reddedilen okuma sayaclari yalnizca Redis'te tutuluyor (ham gozleme yeni
    // kolon eklemek bilincli olarak kapsam disi). Redis erisilemezse oran
    // null doner, sayfa yine calisir.
    const counters = await this.signalStore.readCountersMany(
      users.map((user) => user.id),
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

      // PresenceStatus.NO_SIGNAL iki farkli gercekligi tek etikette birlestirir
      // (zayif sinyal / sessiz cihaz). Ayrimi burada yapiyoruz: cihaz gercekten
      // susmussa kayitli durum ne olursa olsun NO_SIGNAL gosterilir - aksi
      // halde saatler once kapanmis bir oturumdan kalma IN_HALL panelde
      // "hala icerde" gibi gorunurdu.
      const currentStatus: PresenceStatus =
        status === 'veri_yok'
          ? PresenceStatus.NO_SIGNAL
          : (user.presenceState?.currentStatus ?? PresenceStatus.NO_SIGNAL);

      const userCounters = counters.get(user.id) ?? null;
      const totalReadings = userCounters
        ? userCounters.accepted + userCounters.rejected
        : 0;

      return {
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        devicePlatform: device?.platform ?? null,
        deviceAppVersion: device?.appVersion ?? null,
        lastObservationAt,
        status,
        currentStatus,
        currentHallName:
          currentStatus === PresenceStatus.IN_HALL
            ? (user.presenceState?.openHallVisit?.hall.name ?? null)
            : null,
        outlierRejectionRate:
          totalReadings > 0 ? userCounters!.rejected / totalReadings : null,
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
        icerde: items.filter((i) => i.currentStatus === PresenceStatus.IN_HALL)
          .length,
        belirsiz: items.filter(
          (i) => i.currentStatus === PresenceStatus.AMBIGUOUS,
        ).length,
        sinyalYok: items.filter(
          (i) => i.currentStatus === PresenceStatus.NO_SIGNAL,
        ).length,
      },
    };
  }
}
