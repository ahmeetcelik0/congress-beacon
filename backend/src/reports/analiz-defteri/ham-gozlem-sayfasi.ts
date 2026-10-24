import type ExcelJS from 'exceljs';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toIstanbulWallClockDate } from '../../common/congress-time';
import {
  setupDataWorksheet,
  writeEmptyNotice,
  DATETIME_FORMAT,
} from '../excel/worksheet-setup';
import { formatBeaconLabel, type LookupTables } from './lookup-tables';
import type { ResolvedFilter } from './resolved-filter';

const PAGE_SIZE = 5000;
const EXCEL_MAX_ROWS = 1_048_576;
// Başlık satırı + güvenlik payı - Excel'in mutlak limitine tam dayanmak
// yerine biraz erken kesip net bir uyarı yazmak tercih edildi.
const SAFE_MAX_DATA_ROWS = EXCEL_MAX_ROWS - 2;

export type HamGozlemSonuc = {
  toplamKayit: number;
  yazilanKayit: number;
  kesildi: boolean;
};

// Faz 13a: EN ÖNEMLİ sayfa. `findMany` ile TÜM satırları tek seferde
// çekmek 133 bin kayıtta (gerçek ölçüm) bile yüzlerce megabayt demek -
// 15 milyon satırlık gerçek kongride bu KABUL EDİLEMEZ (bkz. docs/
// decisions.md "Faz 13a"). Bu yüzden cursor tabanlı (keyset) sayfalama
// kullanılır: her turda 5.000 satır çekilir, ExcelJS'e YAZILIR, satırlar
// bellekten DÜŞER (WorksheetWriter `addRow` sonrası satırı kendi iç
// tamponundan flush eder), sonraki tur `id` cursor'ıyla devam eder -
// OFFSET/skip BÜYÜMEZ (MySQL'de büyük OFFSET yavaşlar), bellek SABİT
// kalır (parti boyutuyla orantılı, toplam satır sayısıyla DEĞİL).
export async function yazHamGozlemSayfasi(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  prisma: PrismaService,
  filter: ResolvedFilter,
  lookups: LookupTables,
): Promise<HamGozlemSonuc> {
  const worksheet = setupDataWorksheet(workbook, 'Ham Gözlem', [
    { header: 'Kullanıcı', key: 'kullanici', width: 22 },
    { header: 'userId', key: 'userId', width: 38 },
    { header: 'Cihaz', key: 'cihaz', width: 38 },
    { header: 'Gözlem zamanı (TR)', key: 'gozlemZamani', width: 20 },
    { header: 'Sunucuya varış (TR)', key: 'sunucuyaVaris', width: 20 },
    { header: 'Gecikme (sn)', key: 'gecikmeSn', width: 12 },
    { header: 'observationId', key: 'observationId', width: 38 },
    { header: 'batchId', key: 'batchId', width: 38 },
    { header: 'UUID', key: 'uuid', width: 38 },
    { header: 'Major', key: 'major', width: 8 },
    { header: 'Minor', key: 'minor', width: 8 },
    { header: 'Beacon eşleşti', key: 'eslesti', width: 12 },
    { header: 'beaconId', key: 'beaconId', width: 38 },
    { header: 'Beacon etiketi', key: 'etiket', width: 18 },
    { header: 'Atanan salon', key: 'salon', width: 18 },
    { header: 'RSSI (dBm)', key: 'rssi', width: 10 },
    { header: 'Sentinel', key: 'sentinel', width: 10 },
    { header: 'txPower', key: 'txPower', width: 10 },
    { header: 'Uygulama sürümü', key: 'appVersion', width: 14 },
  ]);
  for (const col of worksheet.columns as ExcelJS.Column[]) {
    if (col.key === 'gozlemZamani' || col.key === 'sunucuyaVaris') {
      col.numFmt = DATETIME_FORMAT;
    }
  }

  const where = buildWhere(filter);
  const toplamKayit = await prisma.beaconObservation.count({ where });

  // batchId -> deviceId eşleştirmesi: `BeaconObservation`da `deviceId`
  // ALANI YOK (bkz. görev tanımı şema notu), `ObservationBatch` üzerinden
  // gidilir. Her partide GÖRÜLEN batch'ler için TEK bir sorguyla toplu
  // çözülür - satır başına ayrı sorgu YAPILMAZ.
  let cursor: string | null = null;
  let yazilanKayit = 0;

  while (true) {
    if (yazilanKayit >= SAFE_MAX_DATA_ROWS) {
      break;
    }
    const take = Math.min(PAGE_SIZE, SAFE_MAX_DATA_ROWS - yazilanKayit);

    const args: Prisma.BeaconObservationFindManyArgs = {
      where,
      orderBy: [{ userId: 'asc' }, { observedAt: 'asc' }, { id: 'asc' }],
      take,
    };
    if (cursor) {
      args.cursor = { id: cursor };
      args.skip = 1;
    }
    const page = await prisma.beaconObservation.findMany(args);
    if (page.length === 0) break;

    const batchIds: string[] = Array.from(new Set(page.map((o) => o.batchId)));
    const batches = await prisma.observationBatch.findMany({
      where: { id: { in: batchIds } },
      select: { id: true, deviceId: true },
    });
    const batchToDevice = new Map(batches.map((b) => [b.id, b.deviceId]));

    for (const obs of page) {
      const gecikmeSn = Math.round(
        (obs.serverReceivedAt.getTime() - obs.observedAt.getTime()) / 1000,
      );
      const isSentinel = obs.rssi >= 0;
      const row = worksheet.addRow({
        kullanici: lookups.userNames.get(obs.userId) ?? '(bilinmiyor)',
        userId: obs.userId,
        cihaz: batchToDevice.get(obs.batchId) ?? '',
        gozlemZamani: toIstanbulWallClockDate(obs.observedAt),
        sunucuyaVaris: toIstanbulWallClockDate(obs.serverReceivedAt),
        gecikmeSn,
        observationId: obs.observationId,
        batchId: obs.batchId,
        uuid: obs.uuid,
        major: obs.major,
        minor: obs.minor,
        eslesti: obs.beaconId ? 1 : 0,
        beaconId: obs.beaconId ?? '',
        etiket: formatBeaconLabel(obs.beaconId, obs.major, obs.minor, lookups),
        salon: obs.beaconId
          ? (lookups.beaconHallNames.get(obs.beaconId) ?? '')
          : '',
        rssi: obs.rssi,
        sentinel: isSentinel ? 1 : 0,
        txPower: obs.txPower ?? '',
        appVersion: obs.appVersion ?? '',
      });
      row.commit();
      yazilanKayit++;
    }

    cursor = page[page.length - 1].id;
    if (page.length < take) break;
  }

  if (yazilanKayit === 0) {
    writeEmptyNotice(worksheet, 'Bu aralıkta kayıt yok.');
  }

  worksheet.commit();
  return { toplamKayit, yazilanKayit, kesildi: toplamKayit > yazilanKayit };
}

export function buildWhere(filter: ResolvedFilter) {
  return {
    congressId: filter.congressId,
    observedAt: { gte: filter.from, lte: filter.to },
    ...(filter.userIds ? { userId: { in: filter.userIds } } : {}),
    ...(filter.beaconIdsForHallFilter
      ? { beaconId: { in: filter.beaconIdsForHallFilter } }
      : {}),
  };
}
