import type ExcelJS from 'exceljs';
import { toIstanbulWallClockDate } from '../../common/congress-time';
import {
  setupDataWorksheet,
  writeEmptyNotice,
  DATETIME_FORMAT,
} from '../excel/worksheet-setup';
import type { LookupTables } from './lookup-tables';
import type { AttendanceEventRow } from './giris-cikis-olaylari-sayfasi';
import { kazananAday, type DecisionTrace } from './decision-trace-types';

// Faz 13b: `AttendanceEvent.decisionTrace`'in candidates dizisini olay
// başına DÜZ tabloya AÇAR - satır: olay x aday salon. `Giriş-Çıkış
// Olayları` sayfasının ZATEN ÇEKTİĞİ event listesinden türetilir, AYRI
// bir sorgu YAPILMAZ (bkz. `analiz-defteri.service.ts` orkestrasyonu).
export function yazKararDetayiSayfasi(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  events: AttendanceEventRow[],
  lookups: LookupTables,
): number {
  const worksheet = setupDataWorksheet(workbook, 'Karar Detayı', [
    { header: 'Olay kimliği', key: 'olayId', width: 38 },
    { header: 'Kullanıcı', key: 'kullanici', width: 22 },
    { header: 'Zaman (TR)', key: 'zaman', width: 20 },
    { header: 'Olay tipi', key: 'tip', width: 10 },
    { header: 'Salon', key: 'salon', width: 18 },
    { header: 'Sıra', key: 'sira', width: 8 },
    { header: 'Kazanan mı', key: 'kazananMi', width: 10 },
    { header: 'Ortalama EMA (dBm)', key: 'emaOrtalama', width: 16 },
    { header: 'Yüzde', key: 'yuzde', width: 10 },
    { header: 'Eşiği geçti mi', key: 'esigiGecti', width: 12 },
    { header: 'Salon eşiği (dBm)', key: 'salonEsigi', width: 14 },
    { header: 'Katkı veren beacon sayısı', key: 'beaconSayisi', width: 18 },
    { header: 'Kabul edilen okuma sayısı', key: 'kabulSayisi', width: 18 },
    { header: 'Bayat (grace) beacon sayısı', key: 'bayatSayisi', width: 20 },
  ]);
  for (const col of worksheet.columns as ExcelJS.Column[]) {
    if (col.key === 'zaman') col.numFmt = DATETIME_FORMAT;
  }

  let yazilan = 0;
  for (const event of events) {
    const trace = event.decisionTrace as DecisionTrace | null;
    // Sinyal hiç görünmediğinde (`emptyDecision`) candidates BOŞ DİZİ olur -
    // Karar Detayı'na satır yazılmaz, olay yalnızca Giriş-Çıkış Olayları'nda
    // görünür (bkz. görev tanımı).
    if (!trace || trace.candidates.length === 0) continue;

    const kazanan = kazananAday(trace);
    const kullanici = lookups.userNames.get(event.userId) ?? '(bilinmiyor)';
    const zamanTr = toIstanbulWallClockDate(event.occurredAt);
    const tip = event.type === 'ENTRY' ? 'GİRİŞ' : 'ÇIKIŞ';

    trace.candidates.forEach((candidate, index) => {
      const bayatSayisi = candidate.beaconReadings.filter(
        (r) => r.stale === true,
      ).length;
      const kabulSayisi = candidate.beaconReadings.filter(
        (r) => r.rawAccepted,
      ).length;

      const row = worksheet.addRow({
        olayId: event.id,
        kullanici,
        zaman: zamanTr,
        tip,
        salon: lookups.hallNames.get(candidate.hallId) ?? '',
        sira: index + 1,
        kazananMi: kazanan === candidate ? 1 : 0,
        emaOrtalama: candidate.emaAverage,
        yuzde: candidate.percentage,
        esigiGecti: candidate.passesThreshold ? 1 : 0,
        salonEsigi: lookups.hallThresholds.get(candidate.hallId) ?? '',
        beaconSayisi: candidate.beaconReadings.length,
        kabulSayisi,
        bayatSayisi,
      });
      row.commit();
      yazilan++;
    });
  }

  if (yazilan === 0) {
    writeEmptyNotice(worksheet, 'Bu aralıkta kayıt yok.');
  }

  worksheet.commit();
  return yazilan;
}
