import { BadRequestException, ConflictException } from '@nestjs/common';
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

function createFakePrisma() {
  return {
    congress: { findUnique: jest.fn() },
    hall: { findUnique: jest.fn() },
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
