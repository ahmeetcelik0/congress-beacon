import { writeExtractionToStaging } from './write-extraction-to-staging';
import {
  ImportRowStatus,
  ProgramRoleType,
  RoleMatchStatus,
} from '../../../generated/prisma/client';
import type { ExtractionResult } from './extraction-schema';

const HALLS = [{ id: 'hall-1', name: 'Salon A' }];

type SessionCreateCall = { data: Record<string, unknown> };

function createFakePrisma() {
  return {
    programImportSession: {
      create: jest
        .fn<Promise<unknown>, [SessionCreateCall]>()
        .mockResolvedValue({}),
    },
  };
}

function createFakeMatching(
  result: { matchStatus: RoleMatchStatus; userId: string | null } = {
    matchStatus: RoleMatchStatus.UNMATCHED,
    userId: null,
  },
) {
  return { matchRole: jest.fn().mockResolvedValue(result) };
}

function baseExtraction(): ExtractionResult {
  return {
    schemaVersion: '1.0',
    congress: {
      name: 'Test',
      startDate: '2026-09-10',
      endDate: null,
      venue: null,
    },
    days: [
      {
        date: '2026-09-10',
        label: '1. Gün',
        halls: [
          {
            name: 'Salon A',
            nameEn: null,
            events: [
              {
                startTime: '09:00',
                endTime: '10:00',
                type: 'session',
                title: 'Açılış Oturumu',
                titleEn: null,
                series: null,
                keywords: ['kardiyoloji'],
                chairs: [],
                panelists: [],
                items: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

function lastSessionCreateData(prisma: ReturnType<typeof createFakePrisma>) {
  const calls = prisma.programImportSession.create.mock.calls;
  return calls[calls.length - 1][0].data;
}

describe('writeExtractionToStaging', () => {
  it('başlığı olan, salonu eşleşen bir etkinliği doğru şekilde yazar', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();
    const extraction = baseExtraction();

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'imp-1',
      'cong-1',
      extraction,
      HALLS,
      new Date(2026, 8, 10),
      null,
    );

    const data = lastSessionCreateData(prisma);
    expect(data.title).toBe('Açılış Oturumu');
    expect(data.hallId).toBe('hall-1');
    expect(data.sessionType).toBe('session');
    expect(data.keywords).toBe('kardiyoloji');
    expect(data.status).toBe(ImportRowStatus.NEW);
    expect(data.warning).toBeNull();
    // Faz 12: `getHours()` (yerel saat getter'i) DEGIL, `toISOString()`
    // (mutlak UTC) kontrol edilir - "10 Eylul 09:00 Turkiye saati" ->
    // 2026-09-10T06:00:00.000Z olmali (bkz. docs/decisions.md "Faz 12").
    expect((data.startTime as Date).toISOString()).toBe(
      '2026-09-10T06:00:00.000Z',
    );
    expect((data.endTime as Date).toISOString()).toBe(
      '2026-09-10T07:00:00.000Z',
    );
  });

  it('yalnızca boşluktan oluşan başlığı INVALID işaretler', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();
    const extraction = baseExtraction();
    extraction.days[0].halls[0].events[0].title = '   ';

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'imp-1',
      'cong-1',
      extraction,
      HALLS,
      null,
      null,
    );

    const data = lastSessionCreateData(prisma);
    expect(data.status).toBe(ImportRowStatus.INVALID);
    expect(data.message).toBe('Başlık belgede bulunamadı');
  });

  it('eşleşmeyen salon adı için hallId null + uyarı bırakır', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();
    const extraction = baseExtraction();
    extraction.days[0].halls[0].name = 'Bilinmeyen Salon';

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'imp-1',
      'cong-1',
      extraction,
      HALLS,
      null,
      null,
    );

    const data = lastSessionCreateData(prisma);
    expect(data.hallId).toBeNull();
    expect(data.rawHallName).toBe('Bilinmeyen Salon');
    expect(data.warning).toBe('Salon eşleşmedi, panelden seçin');
  });

  it('gün tarihi kongre başlangıç tarihinden önceyse uyarı bırakır', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();
    const extraction = baseExtraction();

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'imp-1',
      'cong-1',
      extraction,
      HALLS,
      // `congress.service.ts`teki gercek davranisi yansitmak icin ISO
      // string'den (`new Date(dto.startDate)`) kuruluyor - kongre 15'inde
      // basliyor, gun 10'unda.
      new Date('2026-09-15'),
      null,
    );

    const data = lastSessionCreateData(prisma);
    expect(data.warning).toContain(
      'Gün tarihi kongre başlangıç tarihinden önce',
    );
  });

  it('gün tarihi kongre bitiş tarihinden sonraysa uyarı bırakır', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();
    const extraction = baseExtraction();

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'imp-1',
      'cong-1',
      extraction,
      HALLS,
      null,
      new Date('2026-09-05'), // kongre 5'inde bitiyor, gün 10'unda
    );

    const data = lastSessionCreateData(prisma);
    expect(data.warning).toContain('Gün tarihi kongre bitiş tarihinden sonra');
  });

  it('gün tarihi kongre başlangıç tarihiyle AYNIYSA uyarı bırakmaz (saat dilimi kaymasına karşı regresyon)', async () => {
    // Bug: congress.startDate `new Date(dto.startDate)` ile (tarih-only ISO
    // string -> UTC gece yarisi) kuruluyor, `dayDate` ise YEREL gece yarisi
    // olarak kuruluyor. Bu ikisini dogrudan karsilastirmak, UTC disi bir
    // sunucu saat diliminde (orn. TR, UTC+3) AYNI takvim gunu icin bile
    // yanlislikla "once" uyarisi uretiyordu (bkz. write-extraction-to-
    // staging.ts `toLocalMidnightFromUtcCalendarDate`).
    const prisma = createFakePrisma();
    const matching = createFakeMatching();
    const extraction = baseExtraction();

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'imp-1',
      'cong-1',
      extraction,
      HALLS,
      new Date('2026-09-10'), // gün de 2026-09-10 (baseExtraction)
      new Date('2026-09-12'),
    );

    const data = lastSessionCreateData(prisma);
    expect(data.warning).toBeNull();
  });

  it('aynı salonda çakışan iki etkinlik varsa her ikisine de uyarı bırakır', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();
    const extraction = baseExtraction();
    extraction.days[0].halls[0].events.push({
      startTime: '09:30',
      endTime: '10:30',
      type: 'session',
      title: 'Çakışan Oturum',
      titleEn: null,
      series: null,
      keywords: [],
      chairs: [],
      panelists: [],
      items: [],
    });

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'imp-1',
      'cong-1',
      extraction,
      HALLS,
      null,
      null,
    );

    const calls = prisma.programImportSession.create.mock.calls;
    const first = calls[0][0].data;
    const second = calls[1][0].data;
    expect(first.warning).toContain('çakışan başka bir etkinlik var');
    expect(second.warning).toContain('çakışan başka bir etkinlik var');
  });

  it('çakışmayan iki etkinlik için çakışma uyarısı bırakmaz', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();
    const extraction = baseExtraction();
    extraction.days[0].halls[0].events.push({
      startTime: '10:00',
      endTime: '11:00',
      type: 'session',
      title: 'Ardışık Oturum',
      titleEn: null,
      series: null,
      keywords: [],
      chairs: [],
      panelists: [],
      items: [],
    });

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'imp-1',
      'cong-1',
      extraction,
      HALLS,
      null,
      null,
    );

    const calls = prisma.programImportSession.create.mock.calls;
    expect(calls[0][0].data.warning).toBeNull();
    expect(calls[1][0].data.warning).toBeNull();
  });

  it('öğenin saati etkinlik aralığının dışındaysa sunum satırına uyarı bırakır', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();
    const extraction = baseExtraction();
    extraction.days[0].halls[0].events[0].items = [
      {
        startTime: '08:30',
        endTime: '09:15',
        type: 'presentation',
        code: null,
        title: 'Erken Başlayan Sunum',
        speakers: [],
      },
    ];

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'imp-1',
      'cong-1',
      extraction,
      HALLS,
      null,
      null,
    );

    const data = lastSessionCreateData(prisma);
    const presentations = (
      data.presentations as { create: Array<Record<string, unknown>> }
    ).create;
    expect(presentations[0].warning).toBe(
      'Öğenin saati, ait olduğu etkinliğin saat aralığının dışında',
    );
  });

  it("'discussion' tipi öğeyi de bir sunum satırı olarak yazar", async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();
    const extraction = baseExtraction();
    extraction.days[0].halls[0].events[0].items = [
      {
        startTime: '09:45',
        endTime: '10:00',
        type: 'discussion',
        code: null,
        title: 'Tartışma',
        speakers: [],
      },
    ];

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'imp-1',
      'cong-1',
      extraction,
      HALLS,
      null,
      null,
    );

    const data = lastSessionCreateData(prisma);
    const presentations = (
      data.presentations as { create: Array<Record<string, unknown>> }
    ).create;
    expect(presentations).toHaveLength(1);
    expect(presentations[0].title).toBe('Tartışma');
  });

  it('sunum + konuşmacı rolünü ilişkili şekilde yazar, chairs->MODERATOR panelists->DISCUSSANT olur', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching({
      matchStatus: RoleMatchStatus.AMBIGUOUS,
      userId: null,
    });
    const extraction = baseExtraction();
    extraction.days[0].halls[0].events[0].chairs = ['Prof. Dr. Ahmet Yılmaz'];
    extraction.days[0].halls[0].events[0].panelists = ['Dr. Fatma Şahin'];
    extraction.days[0].halls[0].events[0].items = [
      {
        startTime: '09:00',
        endTime: '09:30',
        type: 'presentation',
        code: 'ZS 001',
        title: 'Bir Sunum',
        speakers: ['Şule Çelik'],
      },
    ];

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'imp-1',
      'cong-1',
      extraction,
      HALLS,
      null,
      null,
    );

    const data = lastSessionCreateData(prisma);
    const roles = (data.roles as { create: Array<Record<string, unknown>> })
      .create;
    expect(roles).toHaveLength(2);
    expect(
      roles.find((r) => r.rawName === 'Prof. Dr. Ahmet Yılmaz')?.type,
    ).toBe(ProgramRoleType.MODERATOR);
    expect(roles.find((r) => r.rawName === 'Dr. Fatma Şahin')?.type).toBe(
      ProgramRoleType.DISCUSSANT,
    );

    const presentations = (
      data.presentations as { create: Array<Record<string, unknown>> }
    ).create;
    expect(presentations[0].code).toBe('ZS 001');
    const presentationRoles = (
      presentations[0].roles as { create: Array<Record<string, unknown>> }
    ).create;
    expect(presentationRoles[0].type).toBe(ProgramRoleType.SPEAKER);
    expect(presentationRoles[0].rawName).toBe('Şule Çelik');
  });

  it('boş isim (boşluk) için rol OLUŞTURMAZ ve matchRole çağırmaz', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();
    const extraction = baseExtraction();
    extraction.days[0].halls[0].events[0].chairs = ['   '];

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'imp-1',
      'cong-1',
      extraction,
      HALLS,
      null,
      null,
    );

    expect(matching.matchRole).not.toHaveBeenCalled();
    const data = lastSessionCreateData(prisma);
    expect(data.roles).toBeUndefined();
  });

  it('birden fazla gün/salon arasında rowOrder GLOBAL olarak artan sırayla devam eder', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching();
    const extraction = baseExtraction();
    extraction.days.push({
      date: '2026-09-11',
      label: '2. Gün',
      halls: [
        {
          name: 'Salon A',
          nameEn: null,
          events: [
            {
              startTime: '09:00',
              endTime: '10:00',
              type: 'session',
              title: '2. Gün Oturumu',
              titleEn: null,
              series: null,
              keywords: [],
              chairs: [],
              panelists: [],
              items: [],
            },
          ],
        },
      ],
    });

    await writeExtractionToStaging(
      prisma as never,
      matching as never,
      'imp-1',
      'cong-1',
      extraction,
      HALLS,
      null,
      null,
    );

    const calls = prisma.programImportSession.create.mock.calls;
    expect(calls[0][0].data.rowOrder).toBe(0);
    expect(calls[1][0].data.rowOrder).toBe(1);
  });
});
