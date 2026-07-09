import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_SENDER } from './notification-sender.interface';
import type { NotificationSender } from './notification-sender.interface';
import { NotificationStatus } from '../../generated/prisma/client';

const QUEUE_NAME = 'session-notifications';
const REMINDER_BEFORE_MS = 10 * 60 * 1000;

type SessionForScheduling = {
  id: string;
  congressId: string;
  title: string;
  startTime: Date;
};

@Injectable()
export class NotificationSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private queue?: Queue<{ sessionId: string }>;
  private worker?: Worker<{ sessionId: string }>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
  ) {}

  onModuleInit() {
    const connection = {
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    };
    this.queue = new Queue<{ sessionId: string }>(QUEUE_NAME, { connection });
    this.worker = new Worker<{ sessionId: string }>(
      QUEUE_NAME,
      async (job) => this.sendSessionReminder(job.data.sessionId),
      { connection },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  private jobIdFor(sessionId: string): string {
    return `session-reminder-${sessionId}`;
  }

  async scheduleForSession(session: SessionForScheduling): Promise<void> {
    if (!this.queue) return;

    await this.cancelForSession(session.id);

    const fireAt = session.startTime.getTime() - REMINDER_BEFORE_MS;
    const delay = Math.max(0, fireAt - Date.now());

    await this.queue.add(
      'reminder',
      { sessionId: session.id },
      { delay, jobId: this.jobIdFor(session.id) },
    );
  }

  async cancelForSession(sessionId: string): Promise<void> {
    await this.queue?.remove(this.jobIdFor(sessionId)).catch(() => {
      // job zaten yoksa/calismissa sessizce yut
    });
  }

  private async sendSessionReminder(sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) return;

    const devices = await this.prisma.device.findMany({
      where: {
        pushToken: { not: null },
        user: { congressId: session.congressId },
      },
    });

    const title = 'Oturum yakında başlıyor';
    const body = `${session.title} 10 dakika içinde başlıyor.`;

    for (const device of devices) {
      const sent = await this.sender.send({
        pushToken: device.pushToken as string,
        title,
        body,
      });

      await this.prisma.notificationLog.create({
        data: {
          sessionId: session.id,
          userId: device.userId,
          deviceId: device.id,
          title,
          body,
          status: sent ? NotificationStatus.SENT : NotificationStatus.FAILED,
        },
      });
    }
  }
}
