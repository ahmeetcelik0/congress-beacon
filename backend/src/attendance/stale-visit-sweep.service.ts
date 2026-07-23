import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttendanceEventType,
  PresenceStatus,
} from '../../generated/prisma/client';

const STALE_AFTER_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 2 * 60 * 1000;
const SWEEP_ALGORITHM_VERSION = 'v1-stale-sweep';
const QUEUE_NAME = 'stale-visit-sweep';

// lastConfirmedAt'i STALE_AFTER_MS'den eski, hala "acik" gorunen HallVisit'leri
// gercekten kapatir (isOpen:false, confidenceLevel:'unknown') ve bir EXIT
// AttendanceEvent'i uretir. Cihaz sessiz kaldiginda (uygulama kapandi/Bluetooth
// kapali) katilimcinin panelde sonsuza kadar "icerde" gorunmesini engeller.
@Injectable()
export class StaleVisitSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StaleVisitSweepService.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const connection = {
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    };

    this.queue = new Queue(QUEUE_NAME, { connection });
    this.worker = new Worker(
      QUEUE_NAME,
      async () => {
        const closedCount = await this.sweep();
        if (closedCount > 0) {
          this.logger.log(
            `${closedCount} bayat ziyaret kapatildi (stale-sweep)`,
          );
        }
      },
      { connection },
    );

    await this.queue.add(
      'sweep',
      {},
      {
        repeat: { every: SWEEP_INTERVAL_MS },
        jobId: 'stale-visit-sweep-repeat',
      },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async sweep(): Promise<number> {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);
    const staleVisits = await this.prisma.hallVisit.findMany({
      where: { isOpen: true, lastConfirmedAt: { lt: cutoff } },
    });

    for (const visit of staleVisits) {
      await this.prisma.$transaction([
        this.prisma.hallVisit.update({
          where: { id: visit.id },
          data: {
            isOpen: false,
            endedAt: visit.lastConfirmedAt,
            confidenceLevel: 'unknown',
          },
        }),
        this.prisma.attendanceEvent.create({
          data: {
            userId: visit.userId,
            hallId: visit.hallId,
            type: AttendanceEventType.EXIT,
            occurredAt: visit.lastConfirmedAt,
            algorithmVersion: SWEEP_ALGORITHM_VERSION,
          },
        }),
        this.prisma.userPresenceState.updateMany({
          where: { openHallVisitId: visit.id },
          data: {
            openHallVisitId: null,
            nonQualifyingStreak: 0,
            candidateHallId: null,
            candidateStreak: 0,
            // Ziyaret cihaz sustugu icin kapatiliyor; presence state'i
            // IN_HALL'da birakmak panelde yanlis bilgi olurdu.
            currentStatus: PresenceStatus.NO_SIGNAL,
          },
        }),
      ]);
    }

    return staleVisits.length;
  }
}
