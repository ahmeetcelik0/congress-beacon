import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  ImportRowStatus,
  ProgramImportStatus,
  ProgramRoleType,
  RoleMatchStatus,
} from '../../../generated/prisma/client';
import {
  ProgramImportsService,
  sourceTypeFromFileName,
} from './program-imports.service';
import { validateExtractionResult } from '../extraction/validate-extraction-result';

function createFakePrisma() {
  return {
    congress: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    hall: { findUnique: jest.fn(), findMany: jest.fn() },
    programImport: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      update: jest.fn(),
    },
    programImportSession: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    },
    programImportPresentation: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    programImportRole: {
      findUnique: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

function createFakeExtraction(configured = true) {
  return {
    isConfigured: jest.fn().mockReturnValue(configured),
    countInputTokens: jest.fn(),
    extract: jest.fn(),
  };
}

function createFakeQueue() {
  return { enqueueExtraction: jest.fn().mockResolvedValue(undefined) };
}

function createFakeMatching() {
  return {
    matchRole: jest.fn().mockResolvedValue({
      matchStatus: RoleMatchStatus.UNMATCHED,
      userId: null,
    }),
  };
}

// Faz 9: approveImport artik her olusturulan oturum icin bildirim job'lari
// planliyor (bkz. program-imports.service.ts) - gercek BullMQ/Redis burada
// GEREKMEZ, yalnizca cagrildigini dogrulayan sahte bir uygulama yeterli.
function createFakeNotificationScheduler() {
  return {
    scheduleForSession: jest.fn().mockResolvedValue(undefined),
    cancelForSession: jest.fn().mockResolvedValue(undefined),
  };
}

function buildService(prisma = createFakePrisma()) {
  const extraction = createFakeExtraction();
  const queue = createFakeQueue();
  const matching = createFakeMatching();
  const notificationScheduler = createFakeNotificationScheduler();
  const service = new ProgramImportsService(
    prisma as never,
    extraction as never,
    queue as never,
    matching as never,
    notificationScheduler as never,
  );
  return {
    service,
    prisma,
    extraction,
    queue,
    matching,
    notificationScheduler,
  };
}

describe('sourceTypeFromFileName', () => {
  it('pdf/xlsx/xls uzantilarini tanir', () => {
    expect(sourceTypeFromFileName('program.pdf')).toBe('PDF');
    expect(sourceTypeFromFileName('PROGRAM.PDF')).toBe('PDF');
    expect(sourceTypeFromFileName('program.xlsx')).toBe('EXCEL');
    expect(sourceTypeFromFileName('program.xls')).toBe('EXCEL');
  });

  it('desteklenmeyen uzanti icin null doner', () => {
    expect(sourceTypeFromFileName('program.docx')).toBeNull();
    expect(sourceTypeFromFileName('program')).toBeNull();
  });
});

describe('ProgramImportsService.approveImport', () => {
  it('status DRAFT degilse 409 verir', async () => {
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.APPROVED,
      congressId: 'cong-1',
    });

    await expect(service.approveImport('imp-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('hallId eksik bir NEW oturum varsa 400 verir, transaction baslamaz', async () => {
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.DRAFT,
      congressId: 'cong-1',
    });
    prisma.programImportSession.findMany.mockResolvedValue([
      {
        id: 'row-1',
        title: 'Oturum X',
        rowOrder: 0,
        hallId: null,
        startTime: new Date(),
        endTime: new Date(),
        roles: [],
        presentations: [],
      },
    ]);

    await expect(service.approveImport('imp-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('INVALID/EXCLUDED satirlari atlar, gecerli oturumu canli tabloya dogru yazar', async () => {
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.DRAFT,
      congressId: 'cong-1',
    });

    // Yalnizca status=NEW olan satirlar sorgulanir (INVALID/EXCLUDED zaten
    // findMany where'inde disaridadir) - bu yuzden burada tek bir gecerli
    // oturum donduruluyor.
    prisma.programImportSession.findMany.mockResolvedValue([
      {
        id: 'row-1',
        title: 'Kardiyoloji Sempozyumu',
        hallId: 'hall-1',
        startTime: new Date(2026, 8, 1, 9, 0),
        endTime: new Date(2026, 8, 1, 10, 30),
        sessionType: 'Sempozyum',
        dayLabel: '1. Gün',
        keywords: 'kardiyoloji',
        roles: [
          {
            type: ProgramRoleType.MODERATOR,
            rawName: 'Ahmet Yılmaz',
            searchName: 'ahmet yilmaz',
            previewMatchStatus: RoleMatchStatus.MATCHED,
            previewUserId: 'user-1',
          },
        ],
        presentations: [
          {
            title: 'Sunum 1',
            startTime: new Date(2026, 8, 1, 9, 0),
            endTime: new Date(2026, 8, 1, 9, 20),
            roles: [
              {
                type: ProgramRoleType.SPEAKER,
                rawName: 'Şule Çelik',
                searchName: 'sule celik',
                previewMatchStatus: RoleMatchStatus.MATCHED,
                previewUserId: 'user-2',
              },
            ],
          },
          {
            // Basliksiz sunum - Presentation.title NOT NULL oldugu icin
            // ATLANMALI, transaction'i BOZMAMALI.
            title: null,
            startTime: null,
            endTime: null,
            roles: [],
          },
        ],
      },
    ]);

    const tx = {
      session: { create: jest.fn().mockResolvedValue({ id: 'session-1' }) },
      programRole: { create: jest.fn().mockResolvedValue({ id: 'role-x' }) },
      presentation: {
        create: jest.fn().mockResolvedValue({ id: 'presentation-1' }),
      },
      programImport: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      Promise.resolve(cb(tx)),
    );

    const summary = await service.approveImport('imp-1');

    expect(tx.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        congressId: 'cong-1',
        hallId: 'hall-1',
        title: 'Kardiyoloji Sempozyumu',
      }) as unknown,
    });
    // Oturum rolu + gecerli sunumun rolu = 2; basliksiz sunumun (atlanan)
    // rolu YOK zaten (bos dizi), yine de sayimi net kontrol edelim.
    expect(tx.programRole.create).toHaveBeenCalledTimes(2);
    expect(tx.presentation.create).toHaveBeenCalledTimes(1);
    expect(tx.programImport.update).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
      data: expect.objectContaining({
        status: ProgramImportStatus.APPROVED,
      }) as unknown,
    });

    expect(summary).toEqual({
      createdSessions: 1,
      createdPresentations: 1,
      createdRoles: 2,
      skippedPresentations: 1,
      createdHalls: [],
    });
  });

  it('sessionRow/presentationRow uzerindeki titleEn/series/code alanlarini canli tabloya aktarir', async () => {
    // Regresyon: Faz 4d Prisma migration'i bu alanlari staging'e ve canli
    // Session/Presentation tablolarina ekledi, ancak `approveImport` ilk
    // yazildiginda `tx.session.create`/`tx.presentation.create` cagrilarina
    // EKLENMEMISTI - staging'de dogru duran veri onayda SESSIZCE kayboluyordu
    // (bkz. docs/decisions.md "Faz 4d", tarayici dogrulamasinda bulundu).
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.DRAFT,
      congressId: 'cong-1',
    });

    prisma.programImportSession.findMany.mockResolvedValue([
      {
        id: 'row-1',
        title: 'Açılış Oturumu',
        hallId: 'hall-1',
        startTime: new Date(2026, 8, 10, 9, 0),
        endTime: new Date(2026, 8, 10, 10, 30),
        sessionType: 'session',
        dayLabel: '1. Gün',
        keywords: '',
        titleEn: 'Opening Session',
        series: 'ZS Serisi',
        roles: [],
        presentations: [
          {
            title: 'Zor Bir Olgu',
            startTime: new Date(2026, 8, 10, 9, 0),
            endTime: new Date(2026, 8, 10, 9, 20),
            titleEn: null,
            code: 'ZS 001',
            roles: [],
          },
        ],
      },
    ]);

    const tx = {
      session: { create: jest.fn().mockResolvedValue({ id: 'session-1' }) },
      programRole: { create: jest.fn().mockResolvedValue({ id: 'role-x' }) },
      presentation: {
        create: jest.fn().mockResolvedValue({ id: 'presentation-1' }),
      },
      programImport: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      Promise.resolve(cb(tx)),
    );

    await service.approveImport('imp-1');

    expect(tx.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        titleEn: 'Opening Session',
        series: 'ZS Serisi',
      }) as unknown,
    });
    expect(tx.presentation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        titleEn: null,
        code: 'ZS 001',
      }) as unknown,
    });
  });

  it('ikinci onay denemesi 409 verir', async () => {
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.APPROVED,
      congressId: 'cong-1',
    });

    await expect(service.approveImport('imp-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  // Faz 4c §3: eslesmeyen ama BELGEDE yazili bir salon adi, onayda otomatik
  // olusturulur - ayni transaction icinde, oturum yazilmadan HEMEN once.
  it('hallId null ama rawHallName varsa salon otomatik olusturulur', async () => {
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.DRAFT,
      congressId: 'cong-1',
    });
    prisma.programImportSession.findMany.mockResolvedValue([
      {
        id: 'row-1',
        title: 'Açılış Oturumu',
        hallId: null,
        rawHallName: 'Salon Yeni',
        hallAutoCreateExcluded: false,
        startTime: new Date(2026, 8, 1, 9, 0),
        endTime: new Date(2026, 8, 1, 10, 0),
        sessionType: null,
        dayLabel: '1. Gün',
        keywords: null,
        roles: [],
        presentations: [],
      },
    ]);

    const tx = {
      hall: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'hall-new-1', name: 'Salon Yeni' }),
      },
      session: { create: jest.fn().mockResolvedValue({ id: 'session-1' }) },
      programRole: { create: jest.fn() },
      presentation: { create: jest.fn() },
      programImport: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      Promise.resolve(cb(tx)),
    );

    const summary = await service.approveImport('imp-1');

    expect(tx.hall.create).toHaveBeenCalledWith({
      data: { congressId: 'cong-1', name: 'Salon Yeni' },
    });
    expect(tx.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ hallId: 'hall-new-1' }) as unknown,
    });
    expect(summary.createdHalls).toEqual([
      { id: 'hall-new-1', name: 'Salon Yeni' },
    ]);
  });

  it('ayni salonun farkli yazimlari TEK Hall olarak olusturulur', async () => {
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.DRAFT,
      congressId: 'cong-1',
    });
    prisma.programImportSession.findMany.mockResolvedValue([
      {
        id: 'row-1',
        title: 'Oturum 1',
        hallId: null,
        rawHallName: 'Salon B',
        hallAutoCreateExcluded: false,
        startTime: new Date(2026, 8, 1, 9, 0),
        endTime: new Date(2026, 8, 1, 10, 0),
        sessionType: null,
        dayLabel: '1. Gün',
        keywords: null,
        roles: [],
        presentations: [],
      },
      {
        id: 'row-2',
        title: 'Oturum 2',
        hallId: null,
        rawHallName: 'salon-b',
        hallAutoCreateExcluded: false,
        startTime: new Date(2026, 8, 1, 11, 0),
        endTime: new Date(2026, 8, 1, 12, 0),
        sessionType: null,
        dayLabel: '1. Gün',
        keywords: null,
        roles: [],
        presentations: [],
      },
    ]);

    const tx = {
      hall: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'hall-new-1', name: 'Salon B' }),
      },
      session: { create: jest.fn().mockResolvedValue({ id: 'session-x' }) },
      programRole: { create: jest.fn() },
      presentation: { create: jest.fn() },
      programImport: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      Promise.resolve(cb(tx)),
    );

    const summary = await service.approveImport('imp-1');

    expect(tx.hall.create).toHaveBeenCalledTimes(1);
    expect(summary.createdHalls).toEqual([
      { id: 'hall-new-1', name: 'Salon B' },
    ]);
    expect(tx.session.create).toHaveBeenCalledTimes(2);
  });

  it('admin adayi kaldirmissa (hallAutoCreateExcluded) yine 400 verir, otomatik olusturulmaz', async () => {
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.DRAFT,
      congressId: 'cong-1',
    });
    prisma.programImportSession.findMany.mockResolvedValue([
      {
        id: 'row-1',
        title: 'Oturum X',
        hallId: null,
        rawHallName: 'Salon Kaldırıldı',
        hallAutoCreateExcluded: true,
        startTime: new Date(),
        endTime: new Date(),
        roles: [],
        presentations: [],
      },
    ]);

    await expect(service.approveImport('imp-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('ProgramImportsService.excludeHallToCreate', () => {
  it('eslesen tum NEW satirlari hallAutoCreateExcluded yapar', async () => {
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.DRAFT,
      congressId: 'cong-1',
    });
    prisma.programImportSession.findMany.mockResolvedValue([
      { id: 'row-1', rawHallName: 'Salon B' },
      { id: 'row-2', rawHallName: 'salon-b' },
      { id: 'row-3', rawHallName: 'Başka Salon' },
    ]);
    prisma.programImportSession.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.excludeHallToCreate('imp-1', 'SALON B');

    expect(prisma.programImportSession.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['row-1', 'row-2'] } },
      data: { hallAutoCreateExcluded: true },
    });
    expect(result).toEqual({ excludedSessionCount: 2 });
  });

  it('eslesen satir yoksa 404 verir', async () => {
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.DRAFT,
      congressId: 'cong-1',
    });
    prisma.programImportSession.findMany.mockResolvedValue([]);

    await expect(
      service.excludeHallToCreate('imp-1', 'Yok Böyle Salon'),
    ).rejects.toThrow('Bu isimde bir salon adayı bulunamadı');
  });
});

describe('ProgramImportsService.cancelImport', () => {
  it('APPROVED durumundaki bir importu iptal etmeye calisirsa 409 verir', async () => {
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.APPROVED,
    });

    await expect(service.cancelImport('imp-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('DRAFT durumundaki bir importu iptal edebilir', async () => {
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.DRAFT,
    });
    prisma.programImport.update.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.CANCELLED,
    });

    await service.cancelImport('imp-1');

    expect(prisma.programImport.update).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
      data: { status: ProgramImportStatus.CANCELLED },
    });
  });
});

describe('ProgramImportsService.createRoleRow - sessionId/presentationId dogrulamasi', () => {
  it('ikisi de gonderilirse 400 verir', async () => {
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.DRAFT,
      congressId: 'cong-1',
    });

    await expect(
      service.createRoleRow('imp-1', {
        importSessionId: 'row-1',
        importPresentationId: 'pres-1',
        type: ProgramRoleType.MODERATOR,
        rawName: 'Ahmet Yılmaz',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.programImportRole.create).not.toHaveBeenCalled();
  });

  it('ikisi de bos gelirse 400 verir', async () => {
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.DRAFT,
      congressId: 'cong-1',
    });

    await expect(
      service.createRoleRow('imp-1', {
        type: ProgramRoleType.MODERATOR,
        rawName: 'Ahmet Yılmaz',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.programImportRole.create).not.toHaveBeenCalled();
  });
});

describe('ProgramImportsService.updateSessionRow - EXCLUDED tek yonludur', () => {
  it('EXCLUDED bir satir duzenlense bile status EXCLUDED kalir', async () => {
    const { service, prisma } = buildService();
    prisma.programImport.findUnique.mockResolvedValue({
      id: 'imp-1',
      status: ProgramImportStatus.DRAFT,
      congressId: 'cong-1',
    });
    prisma.programImportSession.findUnique.mockResolvedValue({
      id: 'row-1',
      importId: 'imp-1',
      status: ImportRowStatus.EXCLUDED,
      title: 'Eski Baslik',
      hallId: null,
      startTime: null,
      endTime: null,
      sessionType: null,
      dayLabel: null,
      keywords: null,
    });
    prisma.programImportSession.update.mockResolvedValue({});

    await service.updateSessionRow('imp-1', 'row-1', { title: 'Yeni Başlık' });

    expect(prisma.programImportSession.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: expect.objectContaining({
        status: ImportRowStatus.EXCLUDED,
      }) as unknown,
    });
  });
});

// Faz 4c §2: LLM cagrisi olmayan senkron yol - `requireConfigured` cagirilmaz
// (extraction mock'undaki `isConfigured` hic KULLANILMAZ), model/token/
// maliyet alanlari hep null kalir.
describe('ProgramImportsService.createJsonImport', () => {
  const VALID_BODY = {
    schemaVersion: '1.0',
    congress: { name: 'Test Kongresi', startDate: '2026-09-10' },
    days: [
      {
        date: '2026-09-10',
        halls: [
          {
            name: 'Ana Salon',
            events: [
              {
                startTime: '09:00',
                endTime: '10:00',
                type: 'session',
                title: 'Açılış',
                items: [],
              },
            ],
          },
        ],
      },
    ],
  };

  it('kongre bulunamazsa 404 verir, hicbir ProgramImport olusturulmaz', async () => {
    const { service, prisma } = buildService();
    prisma.congress.findUnique.mockResolvedValue(null);

    await expect(
      service.createJsonImport('cong-x', 'admin-1', 'p.json', VALID_BODY),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.programImport.create).not.toHaveBeenCalled();
  });

  it('semaya uymayan govde icin 400 verir, hicbir ProgramImport olusturulmaz', async () => {
    const { service, prisma } = buildService();
    prisma.congress.findUnique.mockResolvedValue({ id: 'cong-1' });

    await expect(
      service.createJsonImport('cong-1', 'admin-1', 'p.json', {
        schemaVersion: '1.0',
        congress: {},
        days: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.programImport.create).not.toHaveBeenCalled();
  });

  it('gecerli govde icin JSON kaynak turuyle, maliyet alanlari null olarak import olusturur', async () => {
    const { service, prisma } = buildService();
    prisma.congress.findUnique.mockResolvedValue({ id: 'cong-1' });
    prisma.congress.findUniqueOrThrow.mockResolvedValue({
      startDate: new Date(2026, 8, 10),
      endDate: null,
    });
    prisma.hall.findMany.mockResolvedValue([]);
    prisma.programImport.create.mockResolvedValue({
      id: 'imp-json-1',
      status: ProgramImportStatus.EXTRACTING,
    });
    prisma.programImportSession.create.mockResolvedValue({});
    prisma.programImport.update.mockResolvedValue({});

    const result = await service.createJsonImport(
      'cong-1',
      'admin-1',
      'p.json',
      VALID_BODY,
    );

    // Tam esitlik (objectContaining DEGIL) kasitli: model/inputTokens/
    // outputTokens/estimatedCostUsd/pageCount alanlarinin govdeye HIC
    // eklenmedigini (Prisma semadaki varsayilan null'da kaldigini) bu
    // sekilde kanitlar - fazladan bir alan eklenirse test KIRILIR.
    expect(prisma.programImport.create).toHaveBeenCalledWith({
      data: {
        congressId: 'cong-1',
        adminUserId: 'admin-1',
        fileName: 'p.json',
        sourceType: 'JSON',
        status: ProgramImportStatus.EXTRACTING,
      },
    });

    expect(prisma.programImportSession.create).toHaveBeenCalledTimes(1);
    expect(prisma.programImport.update).toHaveBeenCalledWith({
      where: { id: 'imp-json-1' },
      data: { status: ProgramImportStatus.DRAFT },
    });
    expect(result).toEqual({
      importId: 'imp-json-1',
      status: ProgramImportStatus.DRAFT,
    });
  });

  it('staging yazimi sirasinda hata olursa import FAILED olur ve hata yeniden firlatilir', async () => {
    const { service, prisma } = buildService();
    prisma.congress.findUnique.mockResolvedValue({ id: 'cong-1' });
    prisma.congress.findUniqueOrThrow.mockResolvedValue({
      startDate: new Date(2026, 8, 10),
      endDate: null,
    });
    prisma.hall.findMany.mockResolvedValue([]);
    prisma.programImport.create.mockResolvedValue({
      id: 'imp-json-2',
      status: ProgramImportStatus.EXTRACTING,
    });
    prisma.programImportSession.create.mockRejectedValue(
      new Error('DB patladı'),
    );
    prisma.programImportSession.deleteMany.mockResolvedValue({ count: 0 });
    prisma.programImport.update.mockResolvedValue({});

    await expect(
      service.createJsonImport('cong-1', 'admin-1', 'p.json', VALID_BODY),
    ).rejects.toThrow('DB patladı');

    expect(prisma.programImport.update).toHaveBeenCalledWith({
      where: { id: 'imp-json-2' },
      data: {
        status: ProgramImportStatus.FAILED,
        errorMessage: 'DB patladı',
      },
    });
  });
});

describe('ProgramImportsService.getTemplateJson', () => {
  it('sema dogrulayicisindan gecen bir ExtractionResult doner', () => {
    const { service } = buildService();

    const template = service.getTemplateJson();
    const validation = validateExtractionResult(template);

    expect(validation.valid).toBe(true);
  });

  it('en az iki gun, uc farkli salon ve bir kahve arasi icerir', () => {
    const { service } = buildService();
    const template = service.getTemplateJson();

    expect(template.days.length).toBeGreaterThanOrEqual(2);

    const halls = template.days.flatMap((day) => day.halls);
    const hallNames = new Set(halls.map((h) => h.name));
    expect(hallNames.size).toBeGreaterThanOrEqual(3);

    const events = halls.flatMap((h) => h.events);
    expect(events.some((e) => e.type === 'break' && e.items.length === 0)).toBe(
      true,
    );
    expect(events.some((e) => e.items.length > 1)).toBe(true);
    expect(
      events.some((e) => e.chairs.length > 0 && e.panelists.length > 0),
    ).toBe(true);
    expect(
      events.some(
        (e) => e.items.length === 1 && e.items[0].speakers.length === 1,
      ),
    ).toBe(true);
  });
});
