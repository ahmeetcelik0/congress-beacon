import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProgramExtractionService } from '../extraction/program-extraction.service';
import { ProgramImportQueueService } from '../extraction/program-import-queue.service';
import { ProgramRoleMatchingService } from '../program-role-matching.service';
import { NotificationSchedulerService } from '../../notifications/notification-scheduler.service';
import { normalizeTurkishName } from '../../common/normalize-turkish-name';
import {
  buildHallCreationCandidates,
  normalizeHallName,
} from '../extraction/hall-matching';
import { getAnthropicMaxOutputTokens } from '../extraction/anthropic-config';
import { estimateCostUsd } from '../extraction/model-pricing';
import { countPdfPagesBestEffort } from '../extraction/prepare-extraction-input';
import { validateExtractionResult } from '../extraction/validate-extraction-result';
import { writeExtractionToStaging } from '../extraction/write-extraction-to-staging';
import { PROGRAM_IMPORT_JSON_TEMPLATE } from './program-import-json-template';
import { UpdateProgramImportSessionDto } from './dto/update-program-import-session.dto';
import { CreateProgramImportSessionDto } from './dto/create-program-import-session.dto';
import { UpdateProgramImportPresentationDto } from './dto/update-program-import-presentation.dto';
import { CreateProgramImportPresentationDto } from './dto/create-program-import-presentation.dto';
import { UpdateProgramImportRoleDto } from './dto/update-program-import-role.dto';
import { CreateProgramImportRoleDto } from './dto/create-program-import-role.dto';
import { ProgramImportSessionsQueryDto } from './dto/program-import-sessions-query.dto';
import {
  ImportRowStatus,
  Prisma,
  ProgramImportStatus,
  ProgramSourceType,
} from '../../../generated/prisma/client';

export type UploadedFileLike = {
  originalname: string;
  buffer: Buffer;
};

// LLM'in gercek cikti hacmini onceden bilemeyiz - bu, girdi token sayisina
// dayali KABA bir tahmindir. Panelde "tahmini" olarak sunulur, kesin bir
// taahhut degildir. Oran, Faz 4b canli testinde GERCEK bir kongre
// programindan olculdu (25 sayfa: 61674 girdi -> 22395 cikti, ~%36) - kasten
// biraz yuksek tutuldu (dusuk tahmin, kullaniciyi butce asiminda SASIRTIR;
// yuksek tahmin muhafazakar/guvenli taraftadir, bkz. docs/decisions.md).
const OUTPUT_TOKEN_ESTIMATE_RATIO = 0.4;
const MIN_ESTIMATED_OUTPUT_TOKENS = 1000;

const ALLOWED_EXTENSIONS: Record<string, ProgramSourceType> = {
  '.pdf': ProgramSourceType.PDF,
  '.xlsx': ProgramSourceType.EXCEL,
  '.xls': ProgramSourceType.EXCEL,
};

export function sourceTypeFromFileName(
  fileName: string,
): ProgramSourceType | null {
  const match = /\.[^.]+$/.exec(fileName.toLowerCase());
  if (!match) return null;
  return ALLOWED_EXTENSIONS[match[0]] ?? null;
}

const SESSION_TREE_INCLUDE = {
  presentations: {
    orderBy: { rowOrder: 'asc' as const },
    include: { roles: true },
  },
  roles: true,
} satisfies Prisma.ProgramImportSessionInclude;

@Injectable()
export class ProgramImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly extraction: ProgramExtractionService,
    private readonly queue: ProgramImportQueueService,
    private readonly matching: ProgramRoleMatchingService,
    private readonly notificationScheduler: NotificationSchedulerService,
  ) {}

  // Para harcamayan tek uc nokta - yalnizca token SAYAR (bkz.
  // ProgramExtractionService.countInputTokens, `count_tokens` ucretsizdir).
  async estimate(congressId: string, file: UploadedFileLike) {
    this.requireConfigured();
    await this.requireCongress(congressId);
    const sourceType = this.requireSourceType(file.originalname);

    const { inputTokens, model } = await this.extraction.countInputTokens(
      sourceType,
      file.buffer,
    );
    const estimatedOutputTokens = Math.max(
      MIN_ESTIMATED_OUTPUT_TOKENS,
      Math.min(
        getAnthropicMaxOutputTokens(),
        Math.round(inputTokens * OUTPUT_TOKEN_ESTIMATE_RATIO),
      ),
    );
    const estimatedCostUsd = estimateCostUsd(
      model,
      inputTokens,
      estimatedOutputTokens,
    );
    const pageCount =
      sourceType === ProgramSourceType.PDF
        ? countPdfPagesBestEffort(file.buffer)
        : null;

    return {
      model,
      inputTokens,
      estimatedOutputTokens,
      estimatedCostUsd,
      pageCount,
    };
  }

  async createImport(
    congressId: string,
    adminId: string,
    file: UploadedFileLike,
  ) {
    this.requireConfigured();
    await this.requireCongress(congressId);
    const sourceType = this.requireSourceType(file.originalname);

    const importRecord = await this.prisma.programImport.create({
      data: {
        congressId,
        adminUserId: adminId,
        fileName: file.originalname,
        sourceType,
        status: ProgramImportStatus.PENDING,
      },
    });

    await this.queue.enqueueExtraction(
      importRecord.id,
      sourceType,
      file.buffer,
    );

    return { importId: importRecord.id, status: importRecord.status };
  }

  // Faz 4c §2: LLM cagrisi hic YAPILMAZ - bu yuzden `requireConfigured` yok
  // (API anahtari olmasa da bu yol calisir), model/inputTokens/outputTokens/
  // estimatedCostUsd hep null kalir. Islem TAMAMEN senkron (BullMQ'ya
  // GEREK yok, LLM gecikmesi olmadigindan HTTP istegi icinde beklenebilir).
  // Aynı `writeExtractionToStaging`i (Faz 4b'nin LLM yolunun kullandigi
  // FONKSIYONUN AYNISI) cagirir - ikinci bir staging yazma mantigi
  // YAZILMAZ (bkz. Faz 4c talimati "Var olanı çoğaltma, yeniden kullan").
  async createJsonImport(
    congressId: string,
    adminId: string,
    fileName: string,
    rawBody: unknown,
  ) {
    await this.requireCongress(congressId);

    const validation = validateExtractionResult(rawBody);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Yüklenen JSON beklenen şemaya uymuyor',
        errors: validation.errors,
      });
    }

    const importRecord = await this.prisma.programImport.create({
      data: {
        congressId,
        adminUserId: adminId,
        fileName,
        sourceType: ProgramSourceType.JSON,
        status: ProgramImportStatus.EXTRACTING,
      },
    });

    try {
      const [halls, congress] = await Promise.all([
        this.prisma.hall.findMany({
          where: { congressId },
          select: { id: true, name: true },
        }),
        this.prisma.congress.findUniqueOrThrow({
          where: { id: congressId },
          select: { startDate: true },
        }),
      ]);

      await writeExtractionToStaging(
        this.prisma,
        this.matching,
        importRecord.id,
        congressId,
        validation.result,
        halls,
        congress.startDate,
      );

      await this.prisma.programImport.update({
        where: { id: importRecord.id },
        data: { status: ProgramImportStatus.DRAFT },
      });
    } catch (error) {
      // Faz 4b'nin async yolundakiyle (program-import-queue.service.ts)
      // AYNI kurtarma deseni: yari yazilmis staging satirlari BIRAKILMAZ,
      // import FAILED'e cekilir. Ama burada senkron bir HTTP istegi
      // icindeyiz - hata yutulmaz, cagirana (500) YENIDEN FIRLATILIR.
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      await this.prisma.programImportSession
        .deleteMany({ where: { importId: importRecord.id } })
        .catch(() => {});
      await this.prisma.programImport
        .update({
          where: { id: importRecord.id },
          data: { status: ProgramImportStatus.FAILED, errorMessage: message },
        })
        .catch(() => {});
      throw error;
    }

    return { importId: importRecord.id, status: ProgramImportStatus.DRAFT };
  }

  getTemplateJson() {
    return PROGRAM_IMPORT_JSON_TEMPLATE;
  }

  async listImports(congressId: string) {
    const [imports, spend] = await Promise.all([
      this.prisma.programImport.findMany({
        where: { congressId },
        orderBy: { createdAt: 'desc' },
        include: { adminUser: { select: { name: true, email: true } } },
      }),
      this.prisma.programImport.aggregate({
        where: { congressId },
        _sum: { estimatedCostUsd: true },
      }),
    ]);

    return {
      imports,
      totalSpendUsd: spend._sum.estimatedCostUsd ?? 0,
    };
  }

  async getImportDetail(
    importId: string,
    query: ProgramImportSessionsQueryDto,
  ) {
    const importRecord = await this.findImportOrThrow(importId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [
      sessions,
      totalSessions,
      sessionStatusCounts,
      roleMatchCounts,
      presentationCount,
      autoCreateRows,
    ] = await Promise.all([
      this.prisma.programImportSession.findMany({
        where: { importId },
        orderBy: { rowOrder: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: SESSION_TREE_INCLUDE,
      }),
      this.prisma.programImportSession.count({ where: { importId } }),
      this.prisma.programImportSession.groupBy({
        by: ['status'],
        where: { importId },
        _count: { _all: true },
      }),
      this.prisma.programImportRole.groupBy({
        by: ['previewMatchStatus'],
        where: {
          OR: [
            { importSession: { importId } },
            { importPresentation: { importSession: { importId } } },
          ],
        },
        _count: { _all: true },
      }),
      this.prisma.programImportPresentation.count({
        where: { importSession: { importId } },
      }),
      // Faz 4c §3: onizlemede "olusturulacak salonlar" listesi TUM
      // (sayfalanmamis) NEW satirlar uzerinden hesaplanir - sayfa 1'de
      // gorunmeyen bir satirin salon adi da listede eksik KALMAMALI.
      // Yalnizca hallId'si HALA null olan (yani daha once elle
      // eslestirilmemis) satirlar dikkate alinir.
      this.prisma.programImportSession.findMany({
        where: {
          importId,
          status: ImportRowStatus.NEW,
          hallId: null,
          hallAutoCreateExcluded: false,
          NOT: { rawHallName: null },
        },
        select: { rawHallName: true },
      }),
    ]);

    const hallsToCreate = buildHallCreationCandidates(
      autoCreateRows.map((row) => row.rawHallName),
    );

    return {
      import: importRecord,
      sessions,
      total: totalSessions,
      page,
      pageSize,
      summary: {
        sessionsByStatus: Object.fromEntries(
          sessionStatusCounts.map((c) => [c.status, c._count._all]),
        ),
        rolesByMatchStatus: Object.fromEntries(
          roleMatchCounts.map((c) => [c.previewMatchStatus, c._count._all]),
        ),
        presentationCount,
        hallsToCreate,
      },
    };
  }

  // Faz 4c §3: onizlemedeki "olusturulacak salonlar" listesinden TEK bir
  // adayin admin tarafindan kaldirilmasi - o adaya `normalizeHallName` ile
  // birlesen TUM NEW satirlar `hallAutoCreateExcluded: true` isaretlenir.
  // Bu satirlarin hallId'si hala null kalir; onayda eskisi gibi "salon
  // secilmemis" olarak BLOKE eder, admin panelden elle bir salon secmek
  // zorunda kalir (otomatik olusturma iptal edilmis olur, YENIDEN
  // eslestirme YAPILMAZ).
  async excludeHallToCreate(importId: string, hallName: string) {
    await this.requireDraftImport(importId);
    const targetKey = normalizeHallName(hallName);

    const candidateRows = await this.prisma.programImportSession.findMany({
      where: {
        importId,
        status: ImportRowStatus.NEW,
        hallId: null,
        NOT: { rawHallName: null },
      },
      select: { id: true, rawHallName: true },
    });
    const matchingIds = candidateRows
      .filter(
        (row) =>
          row.rawHallName && normalizeHallName(row.rawHallName) === targetKey,
      )
      .map((row) => row.id);

    if (matchingIds.length === 0) {
      throw new NotFoundException('Bu isimde bir salon adayı bulunamadı');
    }

    await this.prisma.programImportSession.updateMany({
      where: { id: { in: matchingIds } },
      data: { hallAutoCreateExcluded: true },
    });

    return { excludedSessionCount: matchingIds.length };
  }

  // --- Oturum satirlari ---

  async updateSessionRow(
    importId: string,
    sessionId: string,
    dto: UpdateProgramImportSessionDto,
  ) {
    const importRecord = await this.requireDraftImport(importId);
    const row = await this.findSessionRowOrThrow(importId, sessionId);

    if (dto.hallId) {
      await this.requireHall(importRecord.congressId, dto.hallId);
    }

    const title =
      dto.title !== undefined ? dto.title.trim() || null : row.title;
    const hallId = dto.hallId !== undefined ? dto.hallId : row.hallId;
    const startTime =
      dto.startTime !== undefined ? new Date(dto.startTime) : row.startTime;
    const endTime =
      dto.endTime !== undefined ? new Date(dto.endTime) : row.endTime;

    const { status, message, warning } = this.reviseSessionRowStatus(
      row.status,
      { title, hallId, startTime, endTime },
    );

    return this.prisma.programImportSession.update({
      where: { id: sessionId },
      data: {
        title,
        hallId,
        startTime,
        endTime,
        sessionType: dto.sessionType ?? row.sessionType,
        dayLabel: dto.dayLabel ?? row.dayLabel,
        keywords: dto.keywords ?? row.keywords,
        status,
        message,
        warning,
      },
    });
  }

  async excludeSessionRow(importId: string, sessionId: string) {
    await this.requireDraftImport(importId);
    await this.findSessionRowOrThrow(importId, sessionId);

    return this.prisma.programImportSession.update({
      where: { id: sessionId },
      data: { status: ImportRowStatus.EXCLUDED },
    });
  }

  async createSessionRow(importId: string, dto: CreateProgramImportSessionDto) {
    const importRecord = await this.requireDraftImport(importId);
    if (dto.hallId) {
      await this.requireHall(importRecord.congressId, dto.hallId);
    }

    const maxOrder = await this.prisma.programImportSession.aggregate({
      where: { importId },
      _max: { rowOrder: true },
    });

    const startTime = dto.startTime ? new Date(dto.startTime) : null;
    const endTime = dto.endTime ? new Date(dto.endTime) : null;
    const { status, message, warning } = this.reviseSessionRowStatus(
      ImportRowStatus.NEW,
      { title: dto.title, hallId: dto.hallId ?? null, startTime, endTime },
    );

    return this.prisma.programImportSession.create({
      data: {
        importId,
        rowOrder: (maxOrder._max.rowOrder ?? -1) + 1,
        title: dto.title.trim(),
        hallId: dto.hallId ?? null,
        startTime,
        endTime,
        sessionType: dto.sessionType,
        dayLabel: dto.dayLabel,
        keywords: dto.keywords,
        status,
        message,
        warning,
      },
    });
  }

  // --- Sunum satirlari ---

  async updatePresentationRow(
    importId: string,
    presentationId: string,
    dto: UpdateProgramImportPresentationDto,
  ) {
    await this.requireDraftImport(importId);
    const row = await this.findPresentationRowOrThrow(importId, presentationId);

    const title =
      dto.title !== undefined ? dto.title.trim() || null : row.title;
    const startTime =
      dto.startTime !== undefined ? new Date(dto.startTime) : row.startTime;
    const endTime =
      dto.endTime !== undefined ? new Date(dto.endTime) : row.endTime;

    const warnings: string[] = [];
    if (!startTime) warnings.push('Başlangıç saati eksik');
    if (!endTime) warnings.push('Bitiş saati eksik');

    return this.prisma.programImportPresentation.update({
      where: { id: presentationId },
      data: {
        title,
        startTime,
        endTime,
        warning: warnings.length ? warnings.join('; ') : null,
      },
    });
  }

  async deletePresentationRow(importId: string, presentationId: string) {
    await this.requireDraftImport(importId);
    await this.findPresentationRowOrThrow(importId, presentationId);
    await this.prisma.programImportPresentation.delete({
      where: { id: presentationId },
    });
    return { deleted: true };
  }

  async createPresentationRow(
    importId: string,
    dto: CreateProgramImportPresentationDto,
  ) {
    await this.requireDraftImport(importId);
    const sessionRow = await this.findSessionRowOrThrow(
      importId,
      dto.importSessionId,
    );

    const maxOrder = await this.prisma.programImportPresentation.aggregate({
      where: { importSessionId: sessionRow.id },
      _max: { rowOrder: true },
    });

    const startTime = dto.startTime ? new Date(dto.startTime) : null;
    const endTime = dto.endTime ? new Date(dto.endTime) : null;
    const warnings: string[] = [];
    if (!startTime) warnings.push('Başlangıç saati eksik');
    if (!endTime) warnings.push('Bitiş saati eksik');

    return this.prisma.programImportPresentation.create({
      data: {
        importSessionId: sessionRow.id,
        rowOrder: (maxOrder._max.rowOrder ?? -1) + 1,
        title: dto.title.trim(),
        startTime,
        endTime,
        warning: warnings.length ? warnings.join('; ') : null,
      },
    });
  }

  // --- Rol satirlari ---

  async updateRoleRow(
    importId: string,
    roleId: string,
    dto: UpdateProgramImportRoleDto,
  ) {
    const importRecord = await this.requireDraftImport(importId);
    await this.findRoleRowOrThrow(importId, roleId);

    const rawName = dto.rawName.trim();
    const searchName = normalizeTurkishName(rawName);
    const match = await this.matching.matchRole(
      importRecord.congressId,
      searchName,
    );

    return this.prisma.programImportRole.update({
      where: { id: roleId },
      data: {
        rawName,
        searchName,
        previewMatchStatus: match.matchStatus,
        previewUserId: match.userId,
      },
    });
  }

  async deleteRoleRow(importId: string, roleId: string) {
    await this.requireDraftImport(importId);
    await this.findRoleRowOrThrow(importId, roleId);
    await this.prisma.programImportRole.delete({ where: { id: roleId } });
    return { deleted: true };
  }

  async createRoleRow(importId: string, dto: CreateProgramImportRoleDto) {
    const importRecord = await this.requireDraftImport(importId);

    if (
      (dto.importSessionId && dto.importPresentationId) ||
      (!dto.importSessionId && !dto.importPresentationId)
    ) {
      throw new BadRequestException(
        'Rol aynı anda hem bir oturuma hem bir sunuma bağlanamaz; tam olarak biri gereklidir',
      );
    }

    if (dto.importSessionId) {
      await this.findSessionRowOrThrow(importId, dto.importSessionId);
    } else if (dto.importPresentationId) {
      await this.findPresentationRowOrThrow(importId, dto.importPresentationId);
    }

    const rawName = dto.rawName.trim();
    const searchName = normalizeTurkishName(rawName);
    const match = await this.matching.matchRole(
      importRecord.congressId,
      searchName,
    );

    return this.prisma.programImportRole.create({
      data: {
        importSessionId: dto.importSessionId ?? null,
        importPresentationId: dto.importPresentationId ?? null,
        type: dto.type,
        rawName,
        searchName,
        previewMatchStatus: match.matchStatus,
        previewUserId: match.userId,
      },
    });
  }

  // --- Onay / iptal ---

  async cancelImport(importId: string) {
    const importRecord = await this.findImportOrThrow(importId);
    const cancellableStatuses: ProgramImportStatus[] = [
      ProgramImportStatus.PENDING,
      ProgramImportStatus.EXTRACTING,
      ProgramImportStatus.DRAFT,
    ];
    if (!cancellableStatuses.includes(importRecord.status)) {
      throw new ConflictException('Bu yükleme zaten sonuçlandırılmış');
    }

    return this.prisma.programImport.update({
      where: { id: importId },
      data: { status: ProgramImportStatus.CANCELLED },
    });
  }

  // Onaylanacak (INVALID/EXCLUDED disi) her oturum icin hallId ZORUNLU -
  // Session.hallId sema seviyesinde NOT NULL'dur. hallId'si olmayan ama
  // belgede bir rawHallName'i olan (ve admin panelden aday olarak
  // KALDIRMAMIS) satirlar Faz 4c §3 geregi burada OTOMATIK bir Hall'a
  // baglanir - digerleri (salon adi hic yoktu YA DA admin adayi kaldirdi)
  // eskisi gibi onayi BLOKE eder (bkz. Faz 4b talimati).
  async approveImport(importId: string) {
    const importRecord = await this.findImportOrThrow(importId);
    if (importRecord.status !== ProgramImportStatus.DRAFT) {
      throw new ConflictException('Bu yükleme zaten sonuçlandırılmış');
    }

    const eligibleSessions = await this.prisma.programImportSession.findMany({
      where: { importId, status: ImportRowStatus.NEW },
      orderBy: { rowOrder: 'asc' },
      include: SESSION_TREE_INCLUDE,
    });

    const autoCreateRows = eligibleSessions.filter(
      (s) => !s.hallId && s.rawHallName?.trim() && !s.hallAutoCreateExcluded,
    );
    const missingHall = eligibleSessions.filter(
      (s) => !s.hallId && !(s.rawHallName?.trim() && !s.hallAutoCreateExcluded),
    );
    if (missingHall.length > 0) {
      throw new BadRequestException({
        message:
          'Şu oturumlarda salon seçilmemiş: bu oturumlar için önce panelden salon seçin',
        sessions: missingHall.map((s) => ({
          id: s.id,
          title: s.title,
          rowOrder: s.rowOrder,
        })),
      });
    }

    const hallNamesToCreate = buildHallCreationCandidates(
      autoCreateRows.map((s) => s.rawHallName),
    );

    // Bildirim planlamasi (BullMQ/Redis) transaction'in DISINDA yapilir -
    // `tx.session.create` bir hata ile GERI ALINIRSA (ör. sonraki bir
    // oturumda beklenmedik bir kisit ihlali), commit OLMAMIS bir oturum
    // icin is planlanmis OLMAMALI (bkz. Faz 9 talimati §3). Bu yuzden
    // olusturulan oturumlar once biriktirilir, transaction basariyla
    // BITTIKTEN SONRA hepsi icin `scheduleForSession` cagrilir.
    const createdSessionRows: {
      id: string;
      congressId: string;
      title: string;
      startTime: Date;
    }[] = [];

    const summary = await this.prisma.$transaction(async (tx) => {
      // Faz 4c §3: eslesmeyen salon adlari (adminin onizlemede TEK TEK
      // kaldirabildigi adaylar) burada, canli tablolara gecmeden HEMEN
      // once olusturulur - boylece hem otomatik olusturma hem oturum
      // yazma AYNI transaction icinde kalir (ya hepsi ya hicbiri).
      // Varsayilan rssiThreshold/capacity Hall semasindaki degerlerden
      // gelir (bkz. schema.prisma) - burada elle tekrar YAZILMAZ.
      const createdHalls: { id: string; name: string }[] = [];
      const hallIdByNormalizedName = new Map<string, string>();
      for (const name of hallNamesToCreate) {
        const hall = await tx.hall.create({
          data: { congressId: importRecord.congressId, name },
        });
        hallIdByNormalizedName.set(normalizeHallName(name), hall.id);
        createdHalls.push({ id: hall.id, name: hall.name });
      }

      let createdSessions = 0;
      let createdPresentations = 0;
      let createdRoles = 0;
      let skippedPresentations = 0;

      for (const sessionRow of eligibleSessions) {
        // Ya satirda zaten bir hallId vardi (eslesti ya da elle secildi),
        // ya da yukarida bu satirin rawHallName'i icin bir Hall YENI
        // olusturuldu - `missingHall` kontrolu ucuncu bir ihtimali
        // ELEMISTI, bu yuzden asagidaki `as string` guvenlidir.
        const resolvedHallId =
          sessionRow.hallId ??
          hallIdByNormalizedName.get(
            normalizeHallName(sessionRow.rawHallName as string),
          );

        const session = await tx.session.create({
          data: {
            congressId: importRecord.congressId,
            hallId: resolvedHallId as string,
            title: sessionRow.title as string,
            startTime: sessionRow.startTime as Date,
            endTime: sessionRow.endTime as Date,
            sessionType: sessionRow.sessionType,
            dayLabel: sessionRow.dayLabel,
            keywords: sessionRow.keywords,
          },
        });
        createdSessions++;
        createdSessionRows.push(session);

        for (const roleRow of sessionRow.roles) {
          await tx.programRole.create({
            data: {
              sessionId: session.id,
              type: roleRow.type,
              rawName: roleRow.rawName,
              searchName: roleRow.searchName,
              matchStatus: roleRow.previewMatchStatus,
              userId: roleRow.previewUserId,
            },
          });
          createdRoles++;
        }

        for (const presentationRow of sessionRow.presentations) {
          // Presentation.title semada NOT NULL - basliksiz bir sunum
          // ATLANIR (canliya yazilmaz), diger her sey islenmeye devam eder.
          if (!presentationRow.title) {
            skippedPresentations++;
            continue;
          }

          const presentation = await tx.presentation.create({
            data: {
              sessionId: session.id,
              title: presentationRow.title,
              startTime: presentationRow.startTime,
              endTime: presentationRow.endTime,
            },
          });
          createdPresentations++;

          for (const roleRow of presentationRow.roles) {
            await tx.programRole.create({
              data: {
                presentationId: presentation.id,
                type: roleRow.type,
                rawName: roleRow.rawName,
                searchName: roleRow.searchName,
                matchStatus: roleRow.previewMatchStatus,
                userId: roleRow.previewUserId,
              },
            });
            createdRoles++;
          }
        }
      }

      await tx.programImport.update({
        where: { id: importId },
        data: { status: ProgramImportStatus.APPROVED, approvedAt: new Date() },
      });

      return {
        createdSessions,
        createdPresentations,
        createdRoles,
        skippedPresentations,
        createdHalls,
      };
    });

    // Faz 9: her onaylanan oturum icin bildirim job'lari planlanir. Gecmis
    // tarihli oturumlar (ör. arsivlenmis eski bir program yuklendiginde)
    // `scheduleForSession` icindeki `shouldScheduleJob` kontrolunden
    // GECMEZ - toplu bir bildirim yagmuru OLMAZ (bkz. Faz 9 talimati §3).
    for (const session of createdSessionRows) {
      await this.notificationScheduler.scheduleForSession(session);
    }

    return summary;
  }

  // --- Yardimcilar ---

  // API anahtari yoksa endpoint ANINDA 503 doner - dosya kuyruga girip
  // arkada FAILED olarak sessizce basarisiz OLMAZ (bkz. Faz 4b talimati:
  // "uygulama acilista COKMEZ" ama kullaniciya da net, aninda geri
  // bildirim verilmeli).
  private requireConfigured() {
    if (!this.extraction.isConfigured()) {
      throw new ServiceUnavailableException(
        'Program çıkarımı için API anahtarı yapılandırılmamış',
      );
    }
  }

  private async requireCongress(congressId: string) {
    const congress = await this.prisma.congress.findUnique({
      where: { id: congressId },
    });
    if (!congress) throw new NotFoundException('Kongre bulunamadı');
    return congress;
  }

  private async requireHall(congressId: string, hallId: string) {
    const hall = await this.prisma.hall.findUnique({ where: { id: hallId } });
    if (!hall || hall.congressId !== congressId) {
      throw new BadRequestException('Salon bu kongreye ait değil');
    }
    return hall;
  }

  private requireSourceType(fileName: string): ProgramSourceType {
    const sourceType = sourceTypeFromFileName(fileName);
    if (!sourceType) {
      throw new BadRequestException('Desteklenen formatlar: .pdf, .xlsx, .xls');
    }
    return sourceType;
  }

  private async findImportOrThrow(importId: string) {
    const importRecord = await this.prisma.programImport.findUnique({
      where: { id: importId },
    });
    if (!importRecord) throw new NotFoundException('Yükleme bulunamadı');
    return importRecord;
  }

  private async requireDraftImport(importId: string) {
    const importRecord = await this.findImportOrThrow(importId);
    if (importRecord.status !== ProgramImportStatus.DRAFT) {
      throw new ConflictException('Bu yükleme artık düzenlenemez');
    }
    return importRecord;
  }

  private async findSessionRowOrThrow(importId: string, sessionId: string) {
    const row = await this.prisma.programImportSession.findUnique({
      where: { id: sessionId },
    });
    if (!row || row.importId !== importId) {
      throw new NotFoundException('Oturum satırı bulunamadı');
    }
    return row;
  }

  private async findPresentationRowOrThrow(
    importId: string,
    presentationId: string,
  ) {
    const row = await this.prisma.programImportPresentation.findUnique({
      where: { id: presentationId },
      include: { importSession: { select: { importId: true } } },
    });
    if (!row || row.importSession.importId !== importId) {
      throw new NotFoundException('Sunum satırı bulunamadı');
    }
    return row;
  }

  private async findRoleRowOrThrow(importId: string, roleId: string) {
    const row = await this.prisma.programImportRole.findUnique({
      where: { id: roleId },
      include: {
        importSession: { select: { importId: true } },
        importPresentation: {
          select: { importSession: { select: { importId: true } } },
        },
      },
    });
    const rowImportId =
      row?.importSession?.importId ??
      row?.importPresentation?.importSession.importId;
    if (!row || rowImportId !== importId) {
      throw new NotFoundException('Rol satırı bulunamadı');
    }
    return row;
  }

  // Satirin status/message/warning alanlarini MEVCUT alan degerlerinden
  // yeniden hesaplar - "onceden nasil hesaplanmisti" gibi bir gecmis
  // TUTULMAZ, bu daha basit ve saglamdir. EXCLUDED durumu tek yonludur:
  // bir kez disarida birakilan satir duzenlense bile EXCLUDED kalir.
  private reviseSessionRowStatus(
    currentStatus: ImportRowStatus,
    fields: {
      title: string | null;
      hallId: string | null;
      startTime: Date | null;
      endTime: Date | null;
    },
  ): {
    status: ImportRowStatus;
    message: string | null;
    warning: string | null;
  } {
    if (currentStatus === ImportRowStatus.EXCLUDED) {
      return { status: currentStatus, message: null, warning: null };
    }

    const title = fields.title?.trim() || null;
    const status = title ? ImportRowStatus.NEW : ImportRowStatus.INVALID;
    const message = title ? null : 'Başlık zorunludur';

    const warnings: string[] = [];
    if (!fields.hallId) warnings.push('Salon seçilmedi');
    if (!fields.startTime) warnings.push('Başlangıç saati eksik');
    if (!fields.endTime) warnings.push('Bitiş saati eksik');

    return {
      status,
      message,
      warning: warnings.length ? warnings.join('; ') : null,
    };
  }
}
