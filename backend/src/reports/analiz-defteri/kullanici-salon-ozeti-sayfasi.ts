import type ExcelJS from 'exceljs';
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
import type { HallVisitRow } from './salon-ziyaretleri-sayfasi';

// Faz 13a: bu sayfa Salon Ziyaretleri sayfasının ZATEN ÇEKTİĞİ veriden
// (bellekte, filtrelenmiş - HallVisit hacmi gözlem hacmiyle KIYASLANAMAZ,
// binlerce değil onlarca/yüzlerce satır) türetilir - Dakika Özeti'nin
// aksine burada SQL GROUP BY ZORUNLU DEĞİL, ölçek riski yok. AYRI SAYFA
// olarak yazılır (görev tanımı §3.4 "sayfa 3'ün altına ikinci tablo
// KONULMAYACAK" - aynı sayfada iki tablo Excel'in otomatik filtre/
// sıralamasını bozar, birini sıralayınca diğeri kayar).
export function yazKullaniciSalonOzetiSayfasi(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  visits: HallVisitRow[],
  lookups: LookupTables,
): number {
  const worksheet = setupDataWorksheet(workbook, 'Kullanıcı-Salon Özeti', [
    { header: 'Kullanıcı', key: 'kullanici', width: 22 },
    { header: 'userId', key: 'userId', width: 38 },
    { header: 'Salon', key: 'salon', width: 18 },
    { header: 'Ziyaret sayısı', key: 'ziyaretSayisi', width: 12 },
    { header: 'Toplam süre (dk)', key: 'toplamSureNumeric', width: 14 },
    { header: 'Toplam süre', key: 'toplamSureOkunabilir', width: 14 },
    { header: 'Ortalama ziyaret (dk)', key: 'ortalamaSure', width: 16 },
    { header: 'En uzun ziyaret (dk)', key: 'enUzunSure', width: 16 },
    { header: 'İlk giriş (TR)', key: 'ilkGiris', width: 20 },
    { header: 'Son çıkış (TR)', key: 'sonCikis', width: 20 },
    { header: 'Kullanıcı toplamına oranı (%)', key: 'oran', width: 20 },
  ]);
  for (const col of worksheet.columns as ExcelJS.Column[]) {
    if (col.key === 'ilkGiris' || col.key === 'sonCikis')
      col.numFmt = DATETIME_FORMAT;
  }

  type GroupAcc = {
    userId: string;
    hallId: string;
    ziyaretSayisi: number;
    toplamSure: number;
    enUzunSure: number;
    ilkGiris: Date;
    sonCikis: Date | null;
  };
  const groups = new Map<string, GroupAcc>();
  const userTotals = new Map<string, number>();

  for (const visit of visits) {
    const visitEnd = visit.endedAt ?? visit.lastConfirmedAt;
    const sure = minutesBetween(visit.startedAt, visitEnd);
    const key = `${visit.userId}|${visit.hallId}`;

    const existing = groups.get(key);
    if (existing) {
      existing.ziyaretSayisi++;
      existing.toplamSure += sure;
      existing.enUzunSure = Math.max(existing.enUzunSure, sure);
      if (visit.startedAt < existing.ilkGiris)
        existing.ilkGiris = visit.startedAt;
      if (
        visit.endedAt &&
        (!existing.sonCikis || visit.endedAt > existing.sonCikis)
      ) {
        existing.sonCikis = visit.endedAt;
      }
    } else {
      groups.set(key, {
        userId: visit.userId,
        hallId: visit.hallId,
        ziyaretSayisi: 1,
        toplamSure: sure,
        enUzunSure: sure,
        ilkGiris: visit.startedAt,
        sonCikis: visit.endedAt,
      });
    }

    userTotals.set(visit.userId, (userTotals.get(visit.userId) ?? 0) + sure);
  }

  const rows = [...groups.values()].sort((a, b) => {
    const userCompare = a.userId.localeCompare(b.userId);
    return userCompare !== 0 ? userCompare : b.toplamSure - a.toplamSure;
  });

  for (const group of rows) {
    const userTotal = userTotals.get(group.userId) ?? 0;
    const oran =
      userTotal > 0
        ? Math.round((group.toplamSure / userTotal) * 1000) / 10
        : 0;
    const row = worksheet.addRow({
      kullanici: lookups.userNames.get(group.userId) ?? '(bilinmiyor)',
      userId: group.userId,
      salon: lookups.hallNames.get(group.hallId) ?? '',
      ziyaretSayisi: group.ziyaretSayisi,
      toplamSureNumeric: group.toplamSure,
      toplamSureOkunabilir: formatDurationMinutesReadable(group.toplamSure),
      ortalamaSure: Math.round(group.toplamSure / group.ziyaretSayisi),
      enUzunSure: group.enUzunSure,
      ilkGiris: toIstanbulWallClockDate(group.ilkGiris),
      sonCikis: group.sonCikis ? toIstanbulWallClockDate(group.sonCikis) : '',
      oran,
    });
    row.commit();
  }

  if (rows.length === 0) {
    writeEmptyNotice(worksheet, 'Bu aralıkta kayıt yok.');
  }

  worksheet.commit();
  return rows.length;
}
