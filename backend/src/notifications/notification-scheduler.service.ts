import { randomUUID } from 'crypto';
import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_SENDER } from './notification-sender.interface';
import type { NotificationSender } from './notification-sender.interface';
import { NotificationStatus } from '../../generated/prisma/client';
import {
  AGGREGATION_FLUSH_DELAY_MS,
  REMINDER_BEFORE_MS,
  buildReminderNotification,
  buildStartNotification,
  exceedsHourlyCap,
  minuteBucket,
  minuteBucketToRange,
  shouldScheduleJob,
  type SessionNotificationInfo,
} from './notification-scheduling-rules';

const QUEUE_NAME = 'session-notifications';

// Faz 9: iki "tetikleyici" is turu (oturum basina PLANLANIR/IPTAL EDILIR)
// + iki "birlestirme" is turu (tetikleyicinin BULDUGU (kongre, dakika)
// kovasi icin, jobId ile DOGAL olarak tekillestirilir - bkz. onTrigger).
type TriggerKind = 'reminder' | 'start';
type TriggerJobData = { sessionId: string };
type FlushJobData = { congressId: string; bucket: number };
type JobData = TriggerJobData | FlushJobData;

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
  private queue?: Queue<JobData>;
  private worker?: Worker<JobData>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
  ) {}

  onModuleInit() {
    const connection = {
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    };
    this.queue = new Queue<JobData>(QUEUE_NAME, { connection });
    this.worker = new Worker<JobData>(
      QUEUE_NAME,
      async (job) => this.process(job),
      { connection },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  private triggerJobId(sessionId: string, kind: TriggerKind): string {
    return `trigger-${kind}-${sessionId}`;
  }

  private flushJobId(
    kind: TriggerKind,
    congressId: string,
    bucket: number,
  ): string {
    return `flush-${kind}-${congressId}-${bucket}`;
  }

  /// Oturum olusturuldugunda/guncellendiginde cagrilir - HER IKI is turu
  /// (hatirlatma + baslangic) yeniden planlanir. Onceki job'lar ONCE iptal
  /// edilir (ör. saat degistiyse eski zamanlamanin ates almamasi icin).
  async scheduleForSession(session: SessionForScheduling): Promise<void> {
    if (!this.queue) return;

    await this.cancelForSession(session.id);

    const now = Date.now();
    const reminderFireAt = session.startTime.getTime() - REMINDER_BEFORE_MS;
    const startFireAt = session.startTime.getTime();

    if (shouldScheduleJob(reminderFireAt, now)) {
      await this.queue.add(
        'trigger-reminder',
        { sessionId: session.id },
        {
          delay: reminderFireAt - now,
          jobId: this.triggerJobId(session.id, 'reminder'),
        },
      );
    }
    if (shouldScheduleJob(startFireAt, now)) {
      await this.queue.add(
        'trigger-start',
        { sessionId: session.id },
        {
          delay: startFireAt - now,
          jobId: this.triggerJobId(session.id, 'start'),
        },
      );
    }
  }

  async cancelForSession(sessionId: string): Promise<void> {
    await Promise.all([
      this.queue?.remove(this.triggerJobId(sessionId, 'reminder')).catch(() => {
        // job zaten yoksa/calismissa sessizce yut
      }),
      this.queue?.remove(this.triggerJobId(sessionId, 'start')).catch(() => {
        // job zaten yoksa/calismissa sessizce yut
      }),
    ]);
  }

  private async process(job: Job<JobData>): Promise<void> {
    switch (job.name) {
      case 'trigger-reminder':
        await this.onTrigger(
          'reminder',
          (job.data as TriggerJobData).sessionId,
        );
        return;
      case 'trigger-start':
        await this.onTrigger('start', (job.data as TriggerJobData).sessionId);
        return;
      case 'flush-reminder':
        await this.onFlush('reminder', job.data as FlushJobData);
        return;
      case 'flush-start':
        await this.onFlush('start', job.data as FlushJobData);
        return;
    }
  }

  /// Bir oturumun tetikleyici is'i ates aldiginda GONDERMEZ - AYNI (kongre,
  /// dakika) kovasi icin bir "birlestirme" is'i planlar (henuz yoksa). Ayni
  /// dakikada baslayan/hatirlatilan baska oturumlarin tetikleyicileri de
  /// AYNI jobId'yi kullanacagi icin BullMQ bunlari DOGAL olarak
  /// tekillestirir - kova icin yalnizca TEK bir birlestirme is'i calisir
  /// (bkz. Faz 9 talimati §4 "ayni dakikada baslayan oturumlari tek
  /// bildirimde birlestir").
  private async onTrigger(kind: TriggerKind, sessionId: string): Promise<void> {
    if (!this.queue) return;

    // Savunma amacli: `cancelForSession`in `queue.remove()` cagrisi
    // basarisiz olup ESKI bir job kalmis olabilir (bkz. yukarida `.catch`).
    // Oturum artik yoksa (silinmis) sessizce cik.
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) return;

    const fireAtMs =
      kind === 'reminder'
        ? session.startTime.getTime() - REMINDER_BEFORE_MS
        : session.startTime.getTime();
    const bucket = minuteBucket(fireAtMs);

    await this.queue.add(
      `flush-${kind}`,
      { congressId: session.congressId, bucket },
      {
        delay: AGGREGATION_FLUSH_DELAY_MS,
        jobId: this.flushJobId(kind, session.congressId, bucket),
      },
    );
  }

  /// Bir (kongre, dakika) kovasi icin GERCEK gonderimi yapar - o kovaya
  /// dusen (silinmemis/saat DEGISMEMIS) TUM oturumlari veritabanindan
  /// TAZE sorgulayarak bulur (planlama anindaki DEGIL, gonderim anindaki
  /// GERCEK durum kullanilir).
  private async onFlush(
    kind: TriggerKind,
    { congressId, bucket }: FlushJobData,
  ): Promise<void> {
    const { startMs, endMs } = minuteBucketToRange(bucket);
    const offset = kind === 'reminder' ? REMINDER_BEFORE_MS : 0;
    const sessions = await this.prisma.session.findMany({
      where: {
        congressId,
        startTime: {
          gte: new Date(startMs + offset),
          lt: new Date(endMs + offset),
        },
      },
      include: { hall: true },
    });
    if (sessions.length === 0) return;

    const infos: SessionNotificationInfo[] = sessions.map((s) => ({
      sessionId: s.id,
      sessionTitle: s.title,
      hallName: s.hall.name,
      keywords: s.keywords,
    }));
    const content =
      kind === 'reminder'
        ? buildReminderNotification(infos)
        : buildStartNotification(infos);
    // Birlestirilmis (N>1) bir bildirimin "tek" bir oturumu YOKTUR - mobil
    // taraf `sessionId` gelmediginde programa yonlendirmeye duser (bkz.
    // Faz 9 talimati §5).
    const singleSessionId = sessions.length === 1 ? sessions[0].id : null;

    const devices = await this.prisma.device.findMany({
      where: {
        pushToken: { not: null },
        // Faz 1: User artik tek bir kongreye kilitli degil - kongre
        // katilimi CongressRegistration uzerinden kontrol edilir.
        user: {
          registrations: {
            some: { congressId, isActive: true },
          },
        },
      },
    });

    for (const device of devices) {
      await this.sendToDevice(device, content, singleSessionId, congressId);
    }
  }

  /// Kullanici basina saatlik gonderim ustsinirini (bkz.
  /// `HOURLY_NOTIFICATION_CAP`) kontrol edip GERCEK gonderimi yapan TEK
  /// yer - hem hatirlatma hem baslangic bildirimleri BURADAN gecer (bkz.
  /// Faz 9 talimati §4 "bu kurallari tek bir yerde tut").
  private async sendToDevice(
    device: { id: string; userId: string; pushToken: string | null },
    content: { title: string; body: string },
    sessionId: string | null,
    congressId: string,
  ): Promise<void> {
    if (!device.pushToken) return;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sentInLastHour = await this.prisma.notificationLog.count({
      where: {
        userId: device.userId,
        status: NotificationStatus.SENT,
        sentAt: { gte: oneHourAgo },
      },
    });

    if (exceedsHourlyCap(sentInLastHour)) {
      await this.prisma.notificationLog.create({
        data: {
          sessionId,
          congressId,
          userId: device.userId,
          deviceId: device.id,
          title: content.title,
          body: content.body,
          status: NotificationStatus.SKIPPED,
        },
      });
      return;
    }

    // id ONCEDEN uretilir: FCM'in "data" alanina konup mobil tarafta derin
    // baglanti + acilma analitigi (`POST /notifications/opened`) icin
    // kullanilir - gonderim SONUCU (SENT/FAILED) henuz bilinmeden once
    // GECERLI bir kimlik lazim (bkz. Faz 9 talimati §5).
    const notificationLogId = randomUUID();
    const sent = await this.sender.send({
      pushToken: device.pushToken,
      title: content.title,
      body: content.body,
      data: {
        notificationLogId,
        ...(sessionId ? { sessionId } : {}),
      },
    });

    await this.prisma.notificationLog.create({
      data: {
        id: notificationLogId,
        sessionId,
        congressId,
        userId: device.userId,
        deviceId: device.id,
        title: content.title,
        body: content.body,
        status: sent ? NotificationStatus.SENT : NotificationStatus.FAILED,
      },
    });
  }
}
