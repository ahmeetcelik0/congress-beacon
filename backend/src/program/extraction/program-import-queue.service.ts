import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExtractionUsage,
  ExtractionUsageError,
  ProgramExtractionService,
} from './program-extraction.service';
import { ProgramRoleMatchingService } from '../program-role-matching.service';
import { writeExtractionToStaging } from './write-extraction-to-staging';
import { countPdfPagesBestEffort } from './prepare-extraction-input';
import { estimateCostUsd } from './model-pricing';
import {
  ProgramImportStatus,
  ProgramSourceType,
} from '../../../generated/prisma/client';

const QUEUE_NAME = 'program-import-extraction';

type ExtractionJobData = {
  importId: string;
  tempFilePath: string;
  sourceType: ProgramSourceType;
};

// Cikarim asenkron olmali (Faz 4b talimati): 150 sayfalik bir belgede LLM
// cagrisi dakikalar surebilir, HTTP istegi icinde beklenemez. NotificationSchedulerService
// ile AYNI BullMQ deseni (bkz. notification-scheduler.service.ts) kullanilir.
@Injectable()
export class ProgramImportQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ProgramImportQueueService.name);
  private queue?: Queue<ExtractionJobData>;
  private worker?: Worker<ExtractionJobData>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly extraction: ProgramExtractionService,
    private readonly matching: ProgramRoleMatchingService,
  ) {}

  onModuleInit() {
    const connection = {
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    };
    this.queue = new Queue<ExtractionJobData>(QUEUE_NAME, { connection });
    this.worker = new Worker<ExtractionJobData>(
      QUEUE_NAME,
      (job) => this.processJob(job.data),
      { connection },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Cikarim isi basarisiz (job ${job?.id}): ${error.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  // Multer bellek depolamasi kullaniyor (proje deseni) - buffer'i DOGRUDAN
  // BullMQ is verisine koymuyoruz (100-150 sayfalik bir PDF onlarca MB
  // olabilir, Redis job payload'i icin uygun degil). Bunun yerine gecici
  // bir dosyaya yazilir, worker okuyup her durumda (basari/hata) siler.
  async enqueueExtraction(
    importId: string,
    sourceType: ProgramSourceType,
    buffer: Buffer,
  ): Promise<void> {
    const tempDir = join(tmpdir(), 'congress-beacon-program-imports');
    await mkdir(tempDir, { recursive: true });
    const tempFilePath = join(tempDir, `${randomUUID()}.bin`);
    await writeFile(tempFilePath, buffer);

    if (!this.queue) {
      await rm(tempFilePath, { force: true }).catch(() => {});
      throw new Error('Is kuyrugu baslatilmadi');
    }

    await this.queue.add('extract', { importId, tempFilePath, sourceType });
  }

  private async processJob(data: ExtractionJobData): Promise<void> {
    const { importId, tempFilePath, sourceType } = data;
    // try disinda tanimlanir ki catch bloğu da erisebilsin - LLM cagrisi
    // basariyla bir yanit alip (yani zaten faturalanip) SONRA bir adim
    // (staging yazimi gibi) basarisiz olursa, gercek token bilgisi kaybolmasin
    // (bkz. docs/decisions.md, Faz 5 - "FAILED kaydinin maliyeti yansitmasi").
    let usage: ExtractionUsage | undefined;

    try {
      await this.prisma.programImport.update({
        where: { id: importId },
        data: { status: ProgramImportStatus.EXTRACTING },
      });

      const buffer = await readFile(tempFilePath);
      const pageCount =
        sourceType === ProgramSourceType.PDF
          ? countPdfPagesBestEffort(buffer)
          : null;

      const outcome = await this.extraction.extract(sourceType, buffer);
      usage = {
        model: outcome.model,
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
      };

      const importRecord = await this.prisma.programImport.findUniqueOrThrow({
        where: { id: importId },
      });
      const [halls, congress] = await Promise.all([
        this.prisma.hall.findMany({
          where: { congressId: importRecord.congressId },
          select: { id: true, name: true },
        }),
        this.prisma.congress.findUniqueOrThrow({
          where: { id: importRecord.congressId },
          select: { startDate: true },
        }),
      ]);

      await writeExtractionToStaging(
        this.prisma,
        this.matching,
        importId,
        importRecord.congressId,
        outcome.result,
        halls,
        congress.startDate,
      );

      await this.prisma.programImport.update({
        where: { id: importId },
        data: {
          status: ProgramImportStatus.DRAFT,
          model: outcome.model,
          inputTokens: outcome.inputTokens,
          outputTokens: outcome.outputTokens,
          estimatedCostUsd: estimateCostUsd(
            outcome.model,
            outcome.inputTokens,
            outcome.outputTokens,
          ),
          pageCount,
        },
      });
    } catch (error) {
      // ExtractionUsageError, mesaj alindiktan (yani faturalandiktan) SONRA
      // olusan hatalarda (red/beklenen blok yok/gecersiz JSON) usage'i tasir -
      // yukarida `outcome`dan zaten set edilmis olabilir ama bu durumda
      // `outcome` hic olusmadigindan yalnizca hata nesnesi uzerinden erisilir.
      if (error instanceof ExtractionUsageError) {
        usage = error.usage;
      }

      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.error(`Import ${importId} cikarimi basarisiz: ${message}`);

      // Kismi yazilmis (yarim kalmis) staging satirlari birakmamak icin -
      // FAILED durumunda staging agacinin BOS olmasi garanti edilir, karisik
      // bir yari-onizleme gorunmez.
      await this.prisma.programImportSession
        .deleteMany({ where: { importId } })
        .catch(() => {});

      await this.prisma.programImport
        .update({
          where: { id: importId },
          data: {
            status: ProgramImportStatus.FAILED,
            errorMessage: message,
            // Cagri hic baslamadiysa (ör. API anahtari yok, gecersiz PDF
            // Anthropic'e ULASMADAN reddedildi) usage tanimsiz kalir, alanlar
            // null'da kalir - panelin "toplam harcama"si yalnizca GERCEKTEN
            // faturalanan cagrilari saysin (bkz. docs/decisions.md, Faz 5).
            ...(usage && {
              model: usage.model,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              estimatedCostUsd: estimateCostUsd(
                usage.model,
                usage.inputTokens,
                usage.outputTokens,
              ),
            }),
          },
        })
        .catch(() => {});
    } finally {
      await rm(tempFilePath, { force: true }).catch(() => {});
    }
  }
}
