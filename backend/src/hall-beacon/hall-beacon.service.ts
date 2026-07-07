import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HallService } from '../hall/hall.service';
import { BeaconService } from '../beacon/beacon.service';
import { AssignHallBeaconDto } from './dto/assign-hall-beacon.dto';

@Injectable()
export class HallBeaconService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hallService: HallService,
    private readonly beaconService: BeaconService,
  ) {}

  async assign(hallId: string, beaconId: string, dto: AssignHallBeaconDto) {
    await this.hallService.findOne(hallId);
    await this.beaconService.findOne(beaconId);

    return this.prisma.$transaction(async (tx) => {
      const activeAssignment = await tx.hallBeacon.findFirst({
        where: { beaconId, isActive: true },
      });

      if (activeAssignment) {
        throw new ConflictException(
          'Bu beacon zaten baska bir salona aktif olarak atanmis; once o atamayi kaldirin',
        );
      }

      return tx.hallBeacon.create({
        data: {
          hallId,
          beaconId,
          rssiThreshold: dto.rssiThreshold,
          calibrationNote: dto.calibrationNote,
          placementNote: dto.placementNote,
        },
      });
    });
  }

  async unassign(hallId: string, beaconId: string) {
    await this.hallService.findOne(hallId);
    await this.beaconService.findOne(beaconId);

    return this.prisma.$transaction(async (tx) => {
      const activeAssignment = await tx.hallBeacon.findFirst({
        where: { hallId, beaconId, isActive: true },
      });

      if (!activeAssignment) {
        throw new NotFoundException('Bu salon icin aktif bir beacon atamasi bulunamadi');
      }

      return tx.hallBeacon.update({
        where: { id: activeAssignment.id },
        data: { isActive: false, removedAt: new Date() },
      });
    });
  }

  async findActiveForHall(hallId: string) {
    await this.hallService.findOne(hallId);
    return this.prisma.hallBeacon.findMany({
      where: { hallId, isActive: true },
      include: { beacon: true },
      orderBy: { installedAt: 'desc' },
    });
  }
}
