import type ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { toIstanbulWallClockDate } from '../../common/congress-time';
import {
  setupDataWorksheet,
  writeEmptyNotice,
  DATETIME_FORMAT,
} from '../excel/worksheet-setup';
import type { LookupTables } from './lookup-tables';
import type { ResolvedFilter } from './resolved-filter';
import {
  kazananAday,
  belirsizMiydi,
  jsonIzMetni,
  type DecisionTrace,
} from './decision-trace-types';

export type AttendanceEventRow = {
  id: string;
  userId: string;
  hallId: string;
  type: 'ENTRY' | 'EXIT';
  occurredAt: Date;
  confidenceScore: number | null;
  algorithmVersion: string;
  decisionTrace: unknown;
};

// Faz 13b: AttendanceEvent hacmi HallVisit ile AYNI mertebede (her ziyaret
// bir ENTRY, açıksa EXIT'siz - test verisinde 304 olay/152 ziyaret) - Ham
// Gözlem'deki cursor'lı sayfalamaya GEREK YOK, `salon-ziyaretleri-sayfasi.ts`
// ile AYNI ölçek varsayımı (bkz. o dosyadaki gerekçe).
export async function fetchAttendanceEventsInRange(
  prisma: PrismaService,
  filter: ResolvedFilter,
): Promise<AttendanceEventRow[]> {
  return prisma.attendanceEvent.findMany({
    where: {
      hall: { congressId: filter.congressId },
      occurredAt: { gte: filter.from, lte: filter.to },
      ...(filter.userIds ? { userId: { in: filter.userIds } } : {}),
      ...(filter.hallIds ? { hallId: { in: filter.hallIds } } : {}),
    },
    select: {
      id: true,
      userId: true,
      hallId: true,
      type: true,
      occurredAt: true,
      confidenceScore: true,
      algorithmVersion: true,
      decisionTrace: true,
    },
    orderBy: [{ userId: 'asc' }, { occurredAt: 'asc' }],
  });
}

export async function yazGirisCikisOlaylariSayfasi(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  prisma: PrismaService,
  filter: ResolvedFilter,
  lookups: LookupTables,
): Promise<AttendanceEventRow[]> {
  const worksheet = setupDataWorksheet(workbook, 'Giriş-Çıkış Olayları', [
    { header: 'Olay kimliği', key: 'id', width: 38 },
    { header: 'Kullanıcı', key: 'kullanici', width: 22 },
    { header: 'userId', key: 'userId', width: 38 },
    { header: 'Salon', key: 'salon', width: 18 },
    { header: 'hallId', key: 'hallId', width: 38 },
    { header: 'Tip', key: 'tip', width: 10 },
    { header: 'Zaman (TR)', key: 'zaman', width: 20 },
    { header: 'Güven puanı (%)', key: 'guven', width: 14 },
    { header: 'Algoritma sürümü', key: 'algoritma', width: 14 },
    { header: 'Kazanan salon ortalama dBm', key: 'kazananDbm', width: 20 },
    { header: 'En yakın rakiple fark (%)', key: 'rakipFarki', width: 18 },
    { header: 'Belirsiz miydi', key: 'belirsiz', width: 12 },
    { header: 'Elenen aykırı okuma', key: 'elenenAykiri', width: 16 },
    { header: 'Görülen salon sayısı', key: 'gorulenSalon', width: 16 },
    { header: 'Eşiği geçen salon sayısı', key: 'esigiGecen', width: 18 },
    { header: 'İkinci salon adı', key: 'ikinciSalon', width: 18 },
    { header: 'İkinci salon yüzdesi', key: 'ikinciYuzde', width: 16 },
    { header: 'Tam karar izi (JSON)', key: 'izJson', width: 40 },
    { header: 'İz kesildi mi', key: 'izKesildi', width: 12 },
  ]);
  for (const col of worksheet.columns as ExcelJS.Column[]) {
    if (col.key === 'zaman') col.numFmt = DATETIME_FORMAT;
  }

  const events = await fetchAttendanceEventsInRange(prisma, filter);
  const ambiguityMarginPct = lookups.congressSettings.ambiguityMarginPct;

  for (const event of events) {
    // `decisionTrace` yazma tarafında (attendance-processing.service.ts)
    // HER ZAMAN doldurulur (boş kararda bile candidates:[] ile) - null
    // ihtimaline yine de karşı yazılır.
    const trace = event.decisionTrace as DecisionTrace | null;
    const kazanan = trace ? kazananAday(trace) : null;
    const ikinciAday = trace?.candidates[1] ?? null;
    const izMetni = trace ? jsonIzMetni(trace) : null;

    const row = worksheet.addRow({
      id: event.id,
      kullanici: lookups.userNames.get(event.userId) ?? '(bilinmiyor)',
      userId: event.userId,
      salon: lookups.hallNames.get(event.hallId) ?? '',
      hallId: event.hallId,
      tip: event.type === 'ENTRY' ? 'GİRİŞ' : 'ÇIKIŞ',
      zaman: toIstanbulWallClockDate(event.occurredAt),
      guven: event.confidenceScore ?? '',
      algoritma: event.algorithmVersion,
      kazananDbm: kazanan?.emaAverage ?? '',
      rakipFarki: trace?.runnerUpGapPct ?? '',
      belirsiz: trace && belirsizMiydi(trace, ambiguityMarginPct) ? 1 : 0,
      elenenAykiri: trace?.rejectedOutliers ?? '',
      gorulenSalon: trace?.candidates.length ?? 0,
      esigiGecen:
        trace?.candidates.filter((c) => c.passesThreshold).length ?? 0,
      ikinciSalon: ikinciAday
        ? (lookups.hallNames.get(ikinciAday.hallId) ?? '')
        : '',
      ikinciYuzde: ikinciAday?.percentage ?? '',
      izJson: izMetni?.metin ?? '',
      izKesildi: izMetni?.kesildi ? 1 : 0,
    });
    row.commit();
  }

  if (events.length === 0) {
    writeEmptyNotice(worksheet, 'Bu aralıkta kayıt yok.');
  }

  worksheet.commit();
  return events;
}
