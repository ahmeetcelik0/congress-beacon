import type ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { toIstanbulWallClockDate } from '../../common/congress-time';
import {
  setupDataWorksheet,
  writeEmptyNotice,
  DATETIME_FORMAT,
} from '../excel/worksheet-setup';
import { minutesBetween } from '../excel/duration-format';
import type { LookupTables } from './lookup-tables';
import type { ResolvedFilter } from './resolved-filter';
import { fetchHallVisitsInRange } from './salon-ziyaretleri-sayfasi';

// Faz 13b: filtre KESİŞİM kuralı Salon Ziyaretleri sayfasıyla AYNI (bkz. o
// dosyadaki gerekçe) - oturum filtre bitmeden başlamış VE filtre başlamadan
// bitmemiş olmalı. "Bu aralıkta salonda bulunan tekil kişi sayısı", o
// oturumun SÜRESİYLE kesişen `HallVisit`lerdeki DISTINCT userId sayısıdır -
// oturum ve ziyaret sayıları küçük/orta ölçekli olduğu için (yüzlerce),
// TÜM ziyaretler bir kere çekilip Node'da her oturum için kesişim aranır.
export async function yazProgramSayfasi(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  prisma: PrismaService,
  filter: ResolvedFilter,
  lookups: LookupTables,
): Promise<number> {
  const worksheet = setupDataWorksheet(workbook, 'Program', [
    { header: 'Oturum kimliği', key: 'id', width: 38 },
    { header: 'Oturum başlığı', key: 'baslik', width: 40 },
    { header: 'Salon', key: 'salon', width: 18 },
    { header: 'Başlangıç (TR)', key: 'baslangic', width: 20 },
    { header: 'Bitiş (TR)', key: 'bitis', width: 20 },
    { header: 'Süre (dk)', key: 'sure', width: 10 },
    { header: 'Oturum tipi', key: 'tip', width: 16 },
    { header: 'Gün etiketi', key: 'gun', width: 14 },
    { header: 'Sunum sayısı', key: 'sunumSayisi', width: 12 },
    { header: 'Anahtar kelimeler', key: 'anahtarKelimeler', width: 30 },
    {
      header: 'Bu aralıkta salonda bulunan tekil kişi sayısı',
      key: 'tekilKisi',
      width: 22,
    },
  ]);
  for (const col of worksheet.columns as ExcelJS.Column[]) {
    if (col.key === 'baslangic' || col.key === 'bitis')
      col.numFmt = DATETIME_FORMAT;
  }

  const [sessions, visits] = await Promise.all([
    prisma.session.findMany({
      where: {
        congressId: filter.congressId,
        startTime: { lte: filter.to },
        endTime: { gte: filter.from },
        ...(filter.hallIds ? { hallId: { in: filter.hallIds } } : {}),
      },
      include: { _count: { select: { presentations: true } } },
      orderBy: [{ startTime: 'asc' }],
    }),
    fetchHallVisitsInRange(prisma, filter),
  ]);

  for (const session of sessions) {
    const tekilKisiler = new Set<string>();
    for (const visit of visits) {
      if (visit.hallId !== session.hallId) continue;
      const visitEnd = visit.endedAt ?? visit.lastConfirmedAt;
      const kesisiyor =
        visit.startedAt < session.endTime && visitEnd > session.startTime;
      if (kesisiyor) tekilKisiler.add(visit.userId);
    }

    const row = worksheet.addRow({
      id: session.id,
      baslik: session.title,
      salon: lookups.hallNames.get(session.hallId) ?? '',
      baslangic: toIstanbulWallClockDate(session.startTime),
      bitis: toIstanbulWallClockDate(session.endTime),
      sure: minutesBetween(session.startTime, session.endTime),
      tip: session.sessionType ?? '',
      gun: session.dayLabel ?? '',
      sunumSayisi: session._count.presentations,
      anahtarKelimeler: session.keywords ?? '',
      tekilKisi: tekilKisiler.size,
    });
    row.commit();
  }

  if (sessions.length === 0) {
    writeEmptyNotice(worksheet, 'Bu aralıkta kayıt yok.');
  }

  worksheet.commit();
  return sessions.length;
}
