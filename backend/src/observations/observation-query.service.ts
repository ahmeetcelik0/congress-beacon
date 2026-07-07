import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ObservationsQueryDto } from './dto/observations-query.dto';

@Injectable()
export class ObservationQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getObservations(query: ObservationsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    let beaconIdFilter: string[] | undefined;
    if (query.hallId) {
      const hallBeacons = await this.prisma.hallBeacon.findMany({
        where: { hallId: query.hallId },
        select: { beaconId: true },
      });
      beaconIdFilter = hallBeacons.map((hallBeacon) => hallBeacon.beaconId);
    }

    const where = {
      congressId: query.congressId,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(beaconIdFilter ? { beaconId: { in: beaconIdFilter } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.beaconObservation.findMany({
        where,
        orderBy: { observedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.beaconObservation.count({ where }),
    ]);

    return {
      items: items.map((observation) => ({
        id: observation.id,
        observationId: observation.observationId,
        userId: observation.userId,
        observedAt: observation.observedAt,
        serverReceivedAt: observation.serverReceivedAt,
        beaconId: observation.beaconId,
        uuid: observation.uuid,
        major: observation.major,
        minor: observation.minor,
        rssi: observation.rssi,
        txPower: observation.txPower,
        appVersion: observation.appVersion,
      })),
      total,
      page,
      pageSize,
    };
  }
}
