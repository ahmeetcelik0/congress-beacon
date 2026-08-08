import {
  ImportRowStatus,
  ProgramRoleType,
  RoleMatchStatus,
} from '../../../generated/prisma/client';
import { writeExtractionToStaging } from './write-extraction-to-staging';
import type { ExtractionResult } from './extraction-schema';

type RoleCreateData = {
  type: ProgramRoleType;
  rawName: string;
  searchName: string;
  previewMatchStatus: RoleMatchStatus;
  previewUserId: string | null;
};

type PresentationCreateData = {
  rowOrder: number;
  title: string | null;
  rawStartTime: string | null;
  rawEndTime: string | null;
  startTime: Date | null;
  endTime: Date | null;
  warning: string | null;
  roles?: { create: RoleCreateData[] };
};

type SessionCreateData = {
  importId: string;
  rowOrder: number;
  title: string | null;
  rawHallName: string | null;
  hallId: string | null;
  dayLabel: string | null;
  rawDate: string | null;
  rawStartTime: string | null;
  rawEndTime: string | null;
  startTime: Date | null;
  endTime: Date | null;
  sessionType: string | null;
  keywords: string | null;
  status: ImportRowStatus;
  message: string | null;
  warning: string | null;
  presentations?: { create: PresentationCreateData[] };
  roles?: { create: RoleCreateData[] };
};

function createFakePrisma() {
  return {
    programImportSession: {
      create: jest.fn().mockResolvedValue({ id: 'row-1' }),
    },
  };
}

function createFakeMatching(
  resultsByName: Record<
    string,
    { matchStatus: RoleMatchStatus; userId: string | null }
  > = {},
) {
  return {
    matchRole: jest.fn().mockImplementation(
      (_congressId: string, searchName: string) =>
        resultsByName[searchName] ?? {
          matchStatus: RoleMatchStatus.UNMATCHED,
          userId: null,
        },
    ),
  };
}

function lastSessionCreateData(
  prisma: ReturnType<typeof createFakePrisma>,
): SessionCreateData {
  const calls = prisma.programImportSession.create.mock.calls as [
    { data: SessionCreateData },
  ][];
  return calls[calls.length - 1][0].data;
}

const HALLS = [{ id: 'hall-1', name: 'Salon A' }];

describe('writeExtractionToStaging', () => {
  it('basligi olan, salonu eslesen, gunu belgede tarihli bir oturumu dogru sekilde yazar', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching({
      'ahmet yilmaz': {
        matchStatus: RoleMatchStatus.MATCHED,
        userId: 'user-1',
      },
    });

    const extraction: ExtractionResult = {
      days: [{ label: '1. Gün', date: '2026-09-01' }],
      sessions: [
        {
          dayLabel: '1. Gün',
          hallName: 'Salon A',
          startTime: '09:00',
          endTime: '10:30',
          title: 'Kardiyoloji Sempozyumu',
          sessionType: 'Sempozyum',
          keywords: ['kardiyoloji', 'ritim'],
          moderators: ['Prof. Dr. Ahmet Yılmaz'],
          discussants: [],
          presentations: [],
        },
      ],
    };

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'import-1',
      'cong-1',
      extraction,
      HALLS,
      null,
    );

    expect(prisma.programImportSession.create).toHaveBeenCalledTimes(1);
    const data = lastSessionCreateData(prisma);

    expect(data.title).toBe('Kardiyoloji Sempozyumu');
    expect(data.status).toBe(ImportRowStatus.NEW);
    expect(data.message).toBeNull();
    expect(data.hallId).toBe('hall-1');
    expect(data.warning).toBeNull();
    expect(data.keywords).toBe('kardiyoloji, ritim');
    expect(data.startTime?.getHours()).toBe(9);
    expect(data.endTime?.getHours()).toBe(10);

    expect(matching.matchRole).toHaveBeenCalledWith('cong-1', 'ahmet yilmaz');
    expect(data.roles?.create).toEqual([
      {
        type: ProgramRoleType.MODERATOR,
        rawName: 'Prof. Dr. Ahmet Yılmaz',
        searchName: 'ahmet yilmaz',
        previewMatchStatus: RoleMatchStatus.MATCHED,
        previewUserId: 'user-1',
      },
    ]);
  });

  it('basligi olmayan bir oturumu INVALID isaretler', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();

    const extraction: ExtractionResult = {
      days: [],
      sessions: [
        {
          dayLabel: null,
          hallName: null,
          startTime: null,
          endTime: null,
          title: null,
          sessionType: null,
          keywords: [],
          moderators: [],
          discussants: [],
          presentations: [],
        },
      ],
    };

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'import-1',
      'cong-1',
      extraction,
      HALLS,
      null,
    );

    const data = lastSessionCreateData(prisma);
    expect(data.status).toBe(ImportRowStatus.INVALID);
    expect(data.message).toBe('Başlık belgede bulunamadı');
  });

  it('eslesmeyen salon adi icin hallId null + uyari birakir', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();

    const extraction: ExtractionResult = {
      days: [{ label: '1. Gün', date: '2026-09-01' }],
      sessions: [
        {
          dayLabel: '1. Gün',
          hallName: 'Olmayan Salon',
          startTime: '09:00',
          endTime: '10:00',
          title: 'Bir Oturum',
          sessionType: null,
          keywords: [],
          moderators: [],
          discussants: [],
          presentations: [],
        },
      ],
    };

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'import-1',
      'cong-1',
      extraction,
      HALLS,
      null,
    );

    const data = lastSessionCreateData(prisma);
    expect(data.hallId).toBeNull();
    expect(data.warning).toContain('Salon eşleşmedi');
  });

  it('tarih kongre baslangicindan turetildiginde uyari birakir', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();
    const congressStart = new Date(2026, 8, 1);

    const extraction: ExtractionResult = {
      days: [{ label: '1. Gün', date: null }],
      sessions: [
        {
          dayLabel: '1. Gün',
          hallName: 'Salon A',
          startTime: '09:00',
          endTime: '10:00',
          title: 'Bir Oturum',
          sessionType: null,
          keywords: [],
          moderators: [],
          discussants: [],
          presentations: [],
        },
      ],
    };

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'import-1',
      'cong-1',
      extraction,
      HALLS,
      congressStart,
    );

    const data = lastSessionCreateData(prisma);
    expect(data.warning).toContain('kongre başlangıcından türetildi');
    expect(data.startTime?.getDate()).toBe(1);
  });

  it('gun etiketi belgede yoksa tarih hesaplanamaz + uyari birakir', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();

    const extraction: ExtractionResult = {
      days: [],
      sessions: [
        {
          dayLabel: null,
          hallName: 'Salon A',
          startTime: '09:00',
          endTime: '10:00',
          title: 'Bir Oturum',
          sessionType: null,
          keywords: [],
          moderators: [],
          discussants: [],
          presentations: [],
        },
      ],
    };

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'import-1',
      'cong-1',
      extraction,
      HALLS,
      new Date(2026, 8, 1),
    );

    const data = lastSessionCreateData(prisma);
    expect(data.startTime).toBeNull();
    expect(data.endTime).toBeNull();
    expect(data.warning).toContain('Gün etiketi belgede yoktu');
  });

  it('sunum + konusmaci rolunu iliskili sekilde yazar, birden fazla aday icin AMBIGUOUS delegasyonu yapar', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching({
      'sule celik': { matchStatus: RoleMatchStatus.AMBIGUOUS, userId: null },
    });

    const extraction: ExtractionResult = {
      days: [{ label: '1. Gün', date: '2026-09-01' }],
      sessions: [
        {
          dayLabel: '1. Gün',
          hallName: 'Salon A',
          startTime: '09:00',
          endTime: '10:30',
          title: 'Oturum',
          sessionType: null,
          keywords: [],
          moderators: [],
          discussants: [],
          presentations: [
            {
              title: 'Sunum 1',
              startTime: '09:00',
              endTime: '09:20',
              speakers: ['Dr. Şule Çelik'],
            },
          ],
        },
      ],
    };

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'import-1',
      'cong-1',
      extraction,
      HALLS,
      null,
    );

    const data = lastSessionCreateData(prisma);
    expect(data.presentations?.create).toHaveLength(1);
    const presentation = data.presentations?.create[0];
    expect(presentation?.title).toBe('Sunum 1');
    expect(presentation?.roles?.create).toEqual([
      {
        type: ProgramRoleType.SPEAKER,
        rawName: 'Dr. Şule Çelik',
        searchName: 'sule celik',
        previewMatchStatus: RoleMatchStatus.AMBIGUOUS,
        previewUserId: null,
      },
    ]);
  });

  it('bos isim (bosluk) icin rol OLUSTURMAZ ve matchRole cagirmaz', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();

    const extraction: ExtractionResult = {
      days: [],
      sessions: [
        {
          dayLabel: null,
          hallName: null,
          startTime: null,
          endTime: null,
          title: 'Oturum',
          sessionType: null,
          keywords: [],
          moderators: ['   '],
          discussants: [],
          presentations: [],
        },
      ],
    };

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'import-1',
      'cong-1',
      extraction,
      HALLS,
      null,
    );

    expect(matching.matchRole).not.toHaveBeenCalled();
    const data = lastSessionCreateData(prisma);
    expect(data.roles).toBeUndefined();
  });
});
