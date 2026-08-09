import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { ObservationBatchDto } from './dto/observation-batch.dto';
import type { AuthenticatedUser } from '../auth/authenticated-request';

export type AcceptedSnapshot = {
  observationId: string;
  observedAt: Date;
  readings: {
    beaconId: string | null;
    uuid: string;
    major: number;
    minor: number;
    rssi: number;
  }[];
};

export type IngestionResult = {
  acceptedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  acceptedSnapshots: AcceptedSnapshot[];
  observationIntervalSeconds: number;
};

@Injectable()
export class ObservationIngestionService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(
    user: AuthenticatedUser,
    dto: ObservationBatchDto,
  ): Promise<IngestionResult> {
    const device = await this.prisma.device.findUnique({
      where: { id: dto.deviceId },
    });
    if (!device || device.userId !== user.id) {
      throw new ForbiddenException('Bu cihaz bu kullaniciya ait degil');
    }

    const batch = await this.prisma.observationBatch.create({
      data: {
        clientBatchId: dto.clientBatchId,
        deviceId: dto.deviceId,
        userId: user.id,
        acceptedCount: 0,
        duplicateCount: 0,
        rejectedCount: 0,
      },
    });

    let acceptedCount = 0;
    let duplicateCount = 0;
    let rejectedCount = 0;
    const acceptedSnapshots: AcceptedSnapshot[] = [];

    for (const snapshot of dto.observations) {
      const alreadyExists = await this.prisma.beaconObservation.findFirst({
        where: { observationId: snapshot.observationId },
        select: { id: true },
      });

      if (alreadyExists) {
        duplicateCount++;
        continue;
      }

      const resolvedBeacons = await Promise.all(
        snapshot.beacons.map(async (reading) => {
          // uuid buyuk harfe normalize edilir - Beacon.uuid artik hep
          // buyuk harfle yaziliyor (bkz. beacon.service.ts), istemciden
          // gelen deger (CoreLocation/CoreBluetooth farkli case dondurebilir)
          // MySQL collation'ina (utf8mb4_unicode_ci, zaten case-insensitive)
          // guvenmeden burada da acikca eslenir - bkz. Faz 6.2 talimati §1.
          const beacon = await this.prisma.beacon.findUnique({
            where: {
              congressId_uuid_major_minor: {
                // ActiveCongressGuard bu uc noktada congressId'nin dolu
                // olmasini garanti eder.
                congressId: user.congressId as string,
                uuid: reading.uuid.toUpperCase(),
                major: reading.major,
                minor: reading.minor,
              },
            },
            select: { id: true },
          });
          return { ...reading, beaconId: beacon?.id ?? null };
        }),
      );

      try {
        await this.prisma.beaconObservation.createMany({
          data: resolvedBeacons.map((reading) => ({
            observationId: snapshot.observationId,
            batchId: batch.id,
            userId: user.id,
            congressId: user.congressId as string,
            observedAt: new Date(snapshot.observedAt),
            beaconId: reading.beaconId,
            uuid: reading.uuid,
            major: reading.major,
            minor: reading.minor,
            rssi: reading.rssi,
            txPower: reading.txPower,
            appVersion: snapshot.appVersion,
          })),
        });

        acceptedCount++;
        acceptedSnapshots.push({
          observationId: snapshot.observationId,
          observedAt: new Date(snapshot.observedAt),
          readings: resolvedBeacons.map((reading) => ({
            beaconId: reading.beaconId,
            uuid: reading.uuid,
            major: reading.major,
            minor: reading.minor,
            rssi: reading.rssi,
          })),
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          duplicateCount++;
        } else {
          rejectedCount++;
        }
      }
    }

    await this.prisma.observationBatch.update({
      where: { id: batch.id },
      data: { acceptedCount, duplicateCount, rejectedCount },
    });

    const congress = await this.prisma.congress.findUnique({
      where: { id: user.congressId as string },
      select: { observationIntervalSeconds: true },
    });

    return {
      acceptedCount,
      duplicateCount,
      rejectedCount,
      acceptedSnapshots,
      observationIntervalSeconds: congress?.observationIntervalSeconds ?? 10,
    };
  }
}
