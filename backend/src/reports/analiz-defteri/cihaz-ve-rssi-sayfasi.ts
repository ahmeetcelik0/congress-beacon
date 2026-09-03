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

// Faz 13b: gruplama (kullanıcı x cihaz x beacon) VERİTABANINDA yapılır -
// Dakika Özeti'yle (Faz 13a) AYNI kural: 133 bin ham gözlemi Node'da
// gruplamak için belleğe almak kabul edilemez. Medyan yine AYRI bir window
// fonksiyonlu sorguda hesaplanıp js tarafında anahtar bazlı birleştirilir.
type IstatistikRow = {
  userId: string;
  deviceId: string;
  platform: string;
  deviceModel: string | null;
  osVersion: string | null;
  appVersion: string | null;
  beaconId: string | null;
  major: number;
  minor: number;
  toplamOkuma: bigint;
  sentinelSayisi: bigint;
  gecerliOkuma: bigint;
  ortalamaRssi: number | null;
  stdSapma: number | null;
  minRssi: number | null;
  maxRssi: number | null;
  ilkOkuma: Date;
  sonOkuma: Date;
};

type MedyanRow = {
  userId: string;
  deviceId: string;
  beaconId: string | null;
  major: number;
  minor: number;
  medyanRssi: number | null;
};

function groupKey(row: {
  userId: string;
  deviceId: string;
  beaconId: string | null;
  major: number;
  minor: number;
}): string {
  return `${row.userId}|${row.deviceId}|${row.beaconId ?? ''}|${row.major}|${row.minor}`;
}

// mysql2/Prisma raw sonuçlarında MIN/MAX/AVG bazen `bigint` dönebilir (bkz.
// `dakika-ozeti-sayfasi.ts`teki aynı bulgu - Faz 13a'da gerçek bir istekle
// keşfedildi). Tip tanımına güvenilmez, `Number()` ZORUNLU.
function numOrEmpty(value: number | bigint | null): number | string {
  return value === null ? '' : Number(value);
}

export async function yazCihazVeRssiSayfasi(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  prisma: PrismaService,
  filter: ResolvedFilter,
  lookups: LookupTables,
): Promise<number> {
  const worksheet = setupDataWorksheet(workbook, 'Cihaz ve RSSI', [
    { header: 'Kullanıcı', key: 'kullanici', width: 22 },
    { header: 'userId', key: 'userId', width: 38 },
    { header: 'deviceId', key: 'deviceId', width: 38 },
    { header: 'Platform', key: 'platform', width: 10 },
    { header: 'Cihaz modeli', key: 'cihazModeli', width: 18 },
    { header: 'İşletim sistemi sürümü', key: 'osVersion', width: 14 },
    { header: 'Uygulama sürümü', key: 'appVersion', width: 14 },
    { header: 'Beacon', key: 'beacon', width: 18 },
    { header: 'Beacon etiketi', key: 'beaconEtiketi', width: 18 },
    { header: 'Atanan salon', key: 'salon', width: 18 },
    { header: 'Toplam okuma', key: 'toplamOkuma', width: 12 },
    { header: 'Sentinel sayısı', key: 'sentinelSayisi', width: 12 },
    { header: 'Sentinel oranı (%)', key: 'sentinelOrani', width: 14 },
    { header: 'Geçerli okuma', key: 'gecerliOkuma', width: 12 },
    { header: 'Ortalama RSSI', key: 'ortalamaRssi', width: 12 },
    { header: 'Medyan RSSI', key: 'medyanRssi', width: 12 },
    { header: 'Standart sapma', key: 'stdSapma', width: 12 },
    { header: 'Min RSSI', key: 'minRssi', width: 10 },
    { header: 'Max RSSI', key: 'maxRssi', width: 10 },
    { header: 'İlk okuma (TR)', key: 'ilkOkuma', width: 20 },
    { header: 'Son okuma (TR)', key: 'sonOkuma', width: 20 },
    { header: 'Beklenen okuma sayısı', key: 'beklenenOkuma', width: 16 },
    { header: 'Gerçekleşme oranı (%)', key: 'gerceklesmeOrani', width: 16 },
  ]);
  for (const col of worksheet.columns as ExcelJS.Column[]) {
    if (col.key === 'ilkOkuma' || col.key === 'sonOkuma')
      col.numFmt = DATETIME_FORMAT;
  }

  const beaconFilter = filter.beaconIdsForHallFilter
    ? Prisma.sql`AND bo.beaconId IN (${Prisma.join(filter.beaconIdsForHallFilter)})`
    : Prisma.empty;
  const userFilter = filter.userIds
    ? Prisma.sql`AND bo.userId IN (${Prisma.join(filter.userIds)})`
    : Prisma.empty;

  const istatistikler = await prisma.$queryRaw<IstatistikRow[]>`
    SELECT
      bo.userId, ob.deviceId, d.platform, d.deviceModel, d.osVersion, d.appVersion,
      bo.beaconId, bo.major, bo.minor,
      COUNT(*) AS toplamOkuma,
      SUM(CASE WHEN bo.rssi >= 0 THEN 1 ELSE 0 END) AS sentinelSayisi,
      SUM(CASE WHEN bo.rssi < 0 THEN 1 ELSE 0 END) AS gecerliOkuma,
      AVG(CASE WHEN bo.rssi < 0 THEN bo.rssi END) AS ortalamaRssi,
      STDDEV_POP(CASE WHEN bo.rssi < 0 THEN bo.rssi END) AS stdSapma,
      MIN(CASE WHEN bo.rssi < 0 THEN bo.rssi END) AS minRssi,
      MAX(CASE WHEN bo.rssi < 0 THEN bo.rssi END) AS maxRssi,
      MIN(bo.observedAt) AS ilkOkuma,
      MAX(bo.observedAt) AS sonOkuma
    FROM BeaconObservation bo
    JOIN ObservationBatch ob ON ob.id = bo.batchId
    JOIN Device d ON d.id = ob.deviceId
    WHERE bo.congressId = ${filter.congressId}
      AND bo.observedAt BETWEEN ${filter.from} AND ${filter.to}
      ${userFilter}
      ${beaconFilter}
    GROUP BY bo.userId, ob.deviceId, bo.beaconId, bo.major, bo.minor
    ORDER BY bo.userId, ob.deviceId
  `;

  const medyanlar = await prisma.$queryRaw<MedyanRow[]>`
    WITH gecerli AS (
      SELECT bo.userId, ob.deviceId, bo.beaconId, bo.major, bo.minor, bo.rssi
      FROM BeaconObservation bo
      JOIN ObservationBatch ob ON ob.id = bo.batchId
      WHERE bo.congressId = ${filter.congressId}
        AND bo.observedAt BETWEEN ${filter.from} AND ${filter.to}
        AND bo.rssi < 0
        ${userFilter}
        ${beaconFilter}
    ),
    siralanmis AS (
      SELECT userId, deviceId, beaconId, major, minor, rssi,
        ROW_NUMBER() OVER (PARTITION BY userId, deviceId, beaconId, major, minor ORDER BY rssi) AS rn,
        COUNT(*) OVER (PARTITION BY userId, deviceId, beaconId, major, minor) AS cnt
      FROM gecerli
    )
    SELECT userId, deviceId, beaconId, major, minor, AVG(rssi) AS medyanRssi
    FROM siralanmis
    WHERE rn IN (FLOOR((cnt+1)/2), CEIL((cnt+1)/2))
    GROUP BY userId, deviceId, beaconId, major, minor
  `;

  const medyanMap = new Map(medyanlar.map((m) => [groupKey(m), m.medyanRssi]));
  const observationIntervalSeconds =
    lookups.congressSettings.observationIntervalSeconds;

  let yazilan = 0;
  for (const row of istatistikler) {
    const araSaniye = (row.sonOkuma.getTime() - row.ilkOkuma.getTime()) / 1000;
    const beklenenOkuma =
      observationIntervalSeconds > 0
        ? Math.max(1, Math.round(araSaniye / observationIntervalSeconds) + 1)
        : null;
    const toplamOkumaSayi = Number(row.toplamOkuma);
    const gerceklesmeOrani = beklenenOkuma
      ? Math.round((toplamOkumaSayi / beklenenOkuma) * 1000) / 10
      : '';

    const excelRow = worksheet.addRow({
      kullanici: lookups.userNames.get(row.userId) ?? '(bilinmiyor)',
      userId: row.userId,
      deviceId: row.deviceId,
      platform: row.platform,
      cihazModeli: row.deviceModel ?? '',
      osVersion: row.osVersion ?? '',
      appVersion: row.appVersion ?? '',
      beacon: formatBeaconLabel(row.beaconId, row.major, row.minor, lookups),
      beaconEtiketi: row.beaconId
        ? (lookups.beaconLabels.get(row.beaconId)?.label ?? '')
        : '',
      salon: row.beaconId
        ? (lookups.beaconHallNames.get(row.beaconId) ?? '')
        : '',
      toplamOkuma: toplamOkumaSayi,
      sentinelSayisi: Number(row.sentinelSayisi),
      sentinelOrani:
        toplamOkumaSayi > 0
          ? Math.round((Number(row.sentinelSayisi) / toplamOkumaSayi) * 1000) /
            10
          : 0,
      gecerliOkuma: Number(row.gecerliOkuma),
      ortalamaRssi:
        row.ortalamaRssi !== null
          ? Math.round(Number(row.ortalamaRssi) * 100) / 100
          : '',
      medyanRssi: numOrEmpty(medyanMap.get(groupKey(row)) ?? null),
      stdSapma:
        row.stdSapma !== null
          ? Math.round(Number(row.stdSapma) * 100) / 100
          : '',
      minRssi: numOrEmpty(row.minRssi),
      maxRssi: numOrEmpty(row.maxRssi),
      ilkOkuma: toIstanbulWallClockDate(row.ilkOkuma),
      sonOkuma: toIstanbulWallClockDate(row.sonOkuma),
      beklenenOkuma: beklenenOkuma ?? '',
      gerceklesmeOrani,
    });
    excelRow.commit();
    yazilan++;
  }

  if (yazilan === 0) {
    writeEmptyNotice(worksheet, 'Bu aralıkta kayıt yok.');
  }

  worksheet.commit();
  return yazilan;
}
