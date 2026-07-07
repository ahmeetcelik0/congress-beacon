import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MobileService {
  constructor(private readonly prisma: PrismaService) {}

  async getBootstrap(congressId: string) {
    const congress = await this.prisma.congress.findUnique({
      where: { id: congressId },
    });
    if (!congress) {
      throw new NotFoundException(`Congress ${congressId} bulunamadi`);
    }

    const halls = await this.prisma.hall.findMany({
      where: { congressId },
      include: {
        hallBeacons: {
          where: { isActive: true },
          include: { beacon: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      congress: {
        id: congress.id,
        name: congress.name,
        beaconUuid: congress.beaconUuid,
      },
      halls: halls.map((hall) => ({
        id: hall.id,
        name: hall.name,
        rssiThreshold: hall.rssiThreshold,
        beacons: hall.hallBeacons.map((hallBeacon) => ({
          major: hallBeacon.beacon.major,
          minor: hallBeacon.beacon.minor,
        })),
      })),
    };
  }
}
