import type ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { toIstanbulWallClockDate } from '../../common/congress-time';
import {
  setupDataWorksheet,
  writeEmptyNotice,
  DATETIME_FORMAT,
} from '../excel/worksheet-setup';
import {
  formatDurationMinutesReadable,
  minutesBetween,
} from '../excel/duration-format';
import type { LookupTables } from './lookup-tables';
import type { ResolvedFilter } from './resolved-filter';

const SWEEP_ALGORITHM_VERSION = 'v1-stale-sweep';

export type HallVisitRow = {
  id: string;
  userId: string;
  hallId: string;
  startedAt: Date;
  endedAt: Date | null;
  lastConfirmedAt: Date;
  isOpen: boolean;
  confidenceLevel: string | null;
  algorithmVersion: string;
};

// Faz 13a: aralıkla KESİŞEN ziyaretler dahil edilir - TAMAMEN aralığın
// içinde kalması BEKLENMEZ. 13:40'ta başlayıp 15:20'de biten bir ziyaret
// "14:00-17:00" filtresinde GÖRÜNMELİDİR, aksi halde sessizce kaybolur
// (bkz. görev tanımı §1). Kesişim koşulu: ziyaret filtre BİTMEDEN
// başlamış VE (hâlâ açık YA DA filtre BAŞLAMADAN bitmemiş) olmalı.
export async function fetchHallVisitsInRange(
  prisma: PrismaService,
  filter: ResolvedFilter,
): Promise<HallVisitRow[]> {
  return prisma.hallVisit.findMany({
    where: {
      hall: { congressId: filter.congressId },
      startedAt: { lte: filter.to },
      OR: [{ endedAt: null }, { endedAt: { gte: filter.from } }],
      ...(filter.userIds ? { userId: { in: filter.userIds } } : {}),
      ...(filter.hallIds ? { hallId: { in: filter.hallIds } } : {}),
    },
    orderBy: [{ userId: 'asc' }, { startedAt: 'asc' }],
  });
}

function kapanisTipi(visit: HallVisitRow): string {
  if (visit.isOpen) return 'Hâlâ açık';
  if (visit.algorithmVersion === SWEEP_ALGORITHM_VERSION)
    return 'Bayat temizlik';
  return 'Normal çıkış';
}

// En çok örtüşen oturumu bulur - ziyaretin zaman aralığı ile o salondaki
// TÜM oturumların kesişim SÜRESİ karşılaştırılır (bkz. görev tanımı §3
// "birden fazla oturumla kesişiyorsa en çok örtüşeni yaz"). Faz 12'den
// sonra oturum saatleri doğru olduğu için bu eşleştirme güvenilir.
function enCokOrtusenOturum(
  visit: HallVisitRow,
  lookups: LookupTables,
): string {
  const visitEnd = visit.endedAt ?? visit.lastConfirmedAt;
  const sessions = lookups.hallSessions.get(visit.hallId) ?? [];

  let best: { title: string; overlapMs: number } | null = null;
  for (const session of sessions) {
    const overlapStart = Math.max(
      visit.startedAt.getTime(),
      session.startTime.getTime(),
    );
    const overlapEnd = Math.min(visitEnd.getTime(), session.endTime.getTime());
    const overlapMs = overlapEnd - overlapStart;
    if (overlapMs > 0 && (!best || overlapMs > best.overlapMs)) {
      best = { title: session.title, overlapMs };
    }
  }
  return best?.title ?? '';
}

export async function yazSalonZiyaretleriSayfasi(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  prisma: PrismaService,
  filter: ResolvedFilter,
  lookups: LookupTables,
): Promise<HallVisitRow[]> {
  const worksheet = setupDataWorksheet(workbook, 'Salon Ziyaretleri', [
    { header: 'Ziyaret kimliği', key: 'id', width: 38 },
    { header: 'Kullanıcı', key: 'kullanici', width: 22 },
    { header: 'userId', key: 'userId', width: 38 },
    { header: 'Salon', key: 'salon', width: 18 },
    { header: 'Başlangıç (TR)', key: 'baslangic', width: 20 },
    { header: 'Bitiş (TR)', key: 'bitis', width: 20 },
    { header: 'Son doğrulama (TR)', key: 'sonDogrulama', width: 20 },
    { header: 'Süre (dk)', key: 'sureNumeric', width: 10 },
    { header: 'Süre', key: 'sureOkunabilir', width: 14 },
    { header: 'Açık mı', key: 'acikMi', width: 10 },
    { header: 'Güven düzeyi', key: 'guven', width: 12 },
    { header: 'Algoritma sürümü', key: 'algoritma', width: 14 },
    { header: 'Kapanış tipi', key: 'kapanisTipi', width: 14 },
    { header: 'O sıradaki oturum', key: 'oturum', width: 30 },
  ]);
  for (const col of worksheet.columns as ExcelJS.Column[]) {
    if (['baslangic', 'bitis', 'sonDogrulama'].includes(col.key as string)) {
      col.numFmt = DATETIME_FORMAT;
    }
  }

  const visits = await fetchHallVisitsInRange(prisma, filter);

  for (const visit of visits) {
    const visitEnd = visit.endedAt ?? visit.lastConfirmedAt;
    const sureNumeric = minutesBetween(visit.startedAt, visitEnd);
    const row = worksheet.addRow({
      id: visit.id,
      kullanici: lookups.userNames.get(visit.userId) ?? '(bilinmiyor)',
      userId: visit.userId,
      salon: lookups.hallNames.get(visit.hallId) ?? '',
      baslangic: toIstanbulWallClockDate(visit.startedAt),
      bitis: visit.endedAt ? toIstanbulWallClockDate(visit.endedAt) : '',
      sonDogrulama: toIstanbulWallClockDate(visit.lastConfirmedAt),
      sureNumeric,
      sureOkunabilir: formatDurationMinutesReadable(sureNumeric),
      acikMi: visit.isOpen ? 1 : 0,
      guven: visit.confidenceLevel ?? '',
      algoritma: visit.algorithmVersion,
      kapanisTipi: kapanisTipi(visit),
      oturum: enCokOrtusenOturum(visit, lookups),
    });
    row.commit();
  }

  if (visits.length === 0) {
    writeEmptyNotice(worksheet, 'Bu aralıkta kayıt yok.');
  }

  worksheet.commit();
  return visits;
}
