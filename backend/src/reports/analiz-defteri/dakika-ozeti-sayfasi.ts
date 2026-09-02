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

// Faz 13a: Prisma'nın `groupBy`'ı dakikaya YUVARLAMA yapamaz (yalnızca
// var olan sütunlarla gruplar) ve MySQL 8.0'da native MEDIAN/PERCENTILE
// fonksiyonu YOK (MariaDB'de var, MySQL'de asla eklenmedi) - bu yüzden
// GRUPLAMA ham SQL ile yapılır (bkz. görev tanımı). 133 bin ham gözlem
// GERÇEK veride 3.524 dakika-grubuna indi (~1.8sn, gerçek veritabanında
// ölçüldü) - bu, Node'da gruplamaktan (133 bin satırı belleğe almak)
// ÖLÇÜLEBİLİR ŞEKİLDE daha güvenli.
//
// Medyan AYRI bir sorguda (window fonksiyonu, ROW_NUMBER+COUNT OVER)
// hesaplanıp ana istatistik sorgusuyla (COUNT/AVG/MIN/MAX, normal
// aggregate) js tarafında anahtar bazlı BİRLEŞTİRİLİR - iki farklı SQL
// üslubunu (aggregate + window) TEK sorguda karıştırmak yerine. Bu
// birleştirme, HAM veri değil ZATEN ÖZETLENMİŞ (grup sayısı kadar, ~3-4
// bin satır) veri üzerinde olduğu için bellek riski YOK.
type IstatistikRow = {
  userId: string;
  beaconId: string | null;
  major: number;
  minor: number;
  dakika: string;
  okumaSayisi: bigint;
  gecerliOkuma: bigint;
  sentinelSayisi: bigint;
  ortalamaRssi: number | null;
  minRssi: number | null;
  maxRssi: number | null;
};

type MedyanRow = {
  userId: string;
  beaconId: string | null;
  major: number;
  minor: number;
  dakika: string;
  medyanRssi: number | null;
};

// mysql2/Prisma `$queryRaw`, MIN/MAX/AVG gibi agregasyon sonuçlarını
// sütunun SQL tipine göre bazen `bigint` olarak döndürür (yalnızca
// `COUNT`/`SUM` DEĞİL - gerçek bir istekle denenip ExcelJS'in
// `TypeError: Do not know how to serialize a BigInt` hatasıyla
// keşfedildi). Tip tanımları (`number | null`) bunu YANSITMAZ - bu
// yüzden `Number()` ZORUNLU, tip beyanına güvenilmez.
function numOrEmpty(value: number | bigint | null): number | string {
  return value === null ? '' : Number(value);
}

function groupKey(row: {
  userId: string;
  beaconId: string | null;
  major: number;
  minor: number;
  dakika: string;
}): string {
  return `${row.userId}|${row.beaconId ?? ''}|${row.major}|${row.minor}|${row.dakika}`;
}

export async function yazDakikaOzetiSayfasi(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  prisma: PrismaService,
  filter: ResolvedFilter,
  lookups: LookupTables,
): Promise<number> {
  const worksheet = setupDataWorksheet(workbook, 'Dakika Özeti', [
    { header: 'Kullanıcı', key: 'kullanici', width: 22 },
    { header: 'userId', key: 'userId', width: 38 },
    { header: 'Dakika (TR)', key: 'dakika', width: 18 },
    { header: 'Beacon', key: 'beacon', width: 18 },
    { header: 'Atanan salon', key: 'salon', width: 18 },
    { header: 'Okuma sayısı', key: 'okumaSayisi', width: 12 },
    { header: 'Geçerli okuma', key: 'gecerliOkuma', width: 12 },
    { header: 'Sentinel sayısı', key: 'sentinelSayisi', width: 12 },
    { header: 'Ortalama RSSI', key: 'ortalamaRssi', width: 12 },
    { header: 'Medyan RSSI', key: 'medyanRssi', width: 12 },
    { header: 'Min RSSI', key: 'minRssi', width: 10 },
    { header: 'Max RSSI', key: 'maxRssi', width: 10 },
  ]);
  for (const col of worksheet.columns as ExcelJS.Column[]) {
    if (col.key === 'dakika') col.numFmt = DATETIME_FORMAT;
  }

  const beaconFilter = filter.beaconIdsForHallFilter
    ? Prisma.sql`AND beaconId IN (${Prisma.join(filter.beaconIdsForHallFilter)})`
    : Prisma.empty;
  const userFilter = filter.userIds
    ? Prisma.sql`AND userId IN (${Prisma.join(filter.userIds)})`
    : Prisma.empty;

  const istatistikler = await prisma.$queryRaw<IstatistikRow[]>`
    SELECT
      userId, beaconId, major, minor,
      DATE_FORMAT(observedAt, '%Y-%m-%d %H:%i:00') AS dakika,
      COUNT(*) AS okumaSayisi,
      SUM(CASE WHEN rssi < 0 THEN 1 ELSE 0 END) AS gecerliOkuma,
      SUM(CASE WHEN rssi >= 0 THEN 1 ELSE 0 END) AS sentinelSayisi,
      AVG(CASE WHEN rssi < 0 THEN rssi END) AS ortalamaRssi,
      MIN(CASE WHEN rssi < 0 THEN rssi END) AS minRssi,
      MAX(CASE WHEN rssi < 0 THEN rssi END) AS maxRssi
    FROM BeaconObservation
    WHERE congressId = ${filter.congressId}
      AND observedAt BETWEEN ${filter.from} AND ${filter.to}
      ${userFilter}
      ${beaconFilter}
    GROUP BY userId, beaconId, major, minor, dakika
    ORDER BY userId, dakika
  `;

  const medyanlar = await prisma.$queryRaw<MedyanRow[]>`
    WITH gecerli AS (
      SELECT userId, beaconId, major, minor,
        DATE_FORMAT(observedAt, '%Y-%m-%d %H:%i:00') AS dakika,
        rssi
      FROM BeaconObservation
      WHERE congressId = ${filter.congressId}
        AND observedAt BETWEEN ${filter.from} AND ${filter.to}
        AND rssi < 0
        ${userFilter}
        ${beaconFilter}
    ),
    siralanmis AS (
      SELECT userId, beaconId, major, minor, dakika, rssi,
        ROW_NUMBER() OVER (PARTITION BY userId, beaconId, major, minor, dakika ORDER BY rssi) AS rn,
        COUNT(*) OVER (PARTITION BY userId, beaconId, major, minor, dakika) AS cnt
      FROM gecerli
    )
    SELECT userId, beaconId, major, minor, dakika, AVG(rssi) AS medyanRssi
    FROM siralanmis
    WHERE rn IN (FLOOR((cnt+1)/2), CEIL((cnt+1)/2))
    GROUP BY userId, beaconId, major, minor, dakika
  `;

  const medyanMap = new Map(medyanlar.map((m) => [groupKey(m), m.medyanRssi]));

  let yazilan = 0;
  for (const row of istatistikler) {
    const excelRow = worksheet.addRow({
      kullanici: lookups.userNames.get(row.userId) ?? '(bilinmiyor)',
      userId: row.userId,
      dakika: toIstanbulWallClockDate(
        new Date(`${row.dakika.replace(' ', 'T')}.000Z`),
      ),
      beacon: formatBeaconLabel(row.beaconId, row.major, row.minor, lookups),
      salon: row.beaconId
        ? (lookups.beaconHallNames.get(row.beaconId) ?? '')
        : '',
      okumaSayisi: Number(row.okumaSayisi),
      gecerliOkuma: Number(row.gecerliOkuma),
      sentinelSayisi: Number(row.sentinelSayisi),
      ortalamaRssi:
        row.ortalamaRssi !== null
          ? Math.round(Number(row.ortalamaRssi) * 100) / 100
          : '',
      medyanRssi: numOrEmpty(medyanMap.get(groupKey(row)) ?? null),
      minRssi: numOrEmpty(row.minRssi),
      maxRssi: numOrEmpty(row.maxRssi),
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
