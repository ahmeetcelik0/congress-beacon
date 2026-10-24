import type ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { toIstanbulWallClockDate } from '../../common/congress-time';
import {
  setupDataWorksheet,
  writeEmptyNotice,
  DATETIME_FORMAT,
} from '../excel/worksheet-setup';
import type { ResolvedFilter } from './resolved-filter';

// Faz 13b: REFERANS sayfası - userIds/hallIds filtresi UYGULANMAZ, kongredeki
// TÜM beacon'lar görünür (yalnızca tarih-saat aralığı "bu aralıktaki okuma
// sayısı" için kullanılır). Satır birimi BEACON'dur; bir beacon'ın birden
// fazla `HallBeacon` kaydı olabilir (geçmiş atamalar) - EN GÜNCEL kayıt
// gösterilir (aktifse o, değilse en son kurulan). Salona atanmamış beacon'lar
// VE beacon atanmamış salonlar da görünmeli (görev tanımı) - bu yüzden
// `HallBeacon` kaydı HİÇ OLMAYAN salonlar için AYRICA "sanal" satırlar
// eklenir (beacon sütunları boş).
export async function yazBeaconEnvanteriSayfasi(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  prisma: PrismaService,
  filter: ResolvedFilter,
): Promise<number> {
  const worksheet = setupDataWorksheet(workbook, 'Beacon Envanteri', [
    { header: 'beaconId', key: 'beaconId', width: 38 },
    { header: 'UUID', key: 'uuid', width: 38 },
    { header: 'Major', key: 'major', width: 8 },
    { header: 'Minor', key: 'minor', width: 8 },
    { header: 'Etiket', key: 'etiket', width: 18 },
    { header: 'Atandığı salon', key: 'salon', width: 18 },
    { header: 'hallId', key: 'hallId', width: 38 },
    { header: 'Salon kapasitesi', key: 'kapasite', width: 14 },
    { header: 'Salon eşiği (dBm)', key: 'salonEsigi', width: 14 },
    { header: 'Beacon eşiği (dBm)', key: 'beaconEsigi', width: 14 },
    { header: 'Aktif mi', key: 'aktifMi', width: 10 },
    { header: 'Kurulum tarihi (TR)', key: 'kurulumTarihi', width: 18 },
    { header: 'Kaldırılma tarihi (TR)', key: 'kaldirilmaTarihi', width: 18 },
    { header: 'Kalibrasyon notu', key: 'kalibrasyonNotu', width: 24 },
    { header: 'Yerleşim notu', key: 'yerlesimNotu', width: 24 },
    { header: 'Bu aralıktaki okuma sayısı', key: 'okumaSayisi', width: 18 },
    { header: 'Ortalama RSSI (bu aralıkta)', key: 'ortalamaRssi', width: 18 },
  ]);
  for (const col of worksheet.columns as ExcelJS.Column[]) {
    if (col.key === 'kurulumTarihi' || col.key === 'kaldirilmaTarihi')
      col.numFmt = DATETIME_FORMAT;
  }

  const [beacons, hallsWithoutBeacon, observationStats, rssiStats] =
    await Promise.all([
      prisma.beacon.findMany({
        where: { congressId: filter.congressId },
        include: {
          hallBeacons: {
            orderBy: [{ isActive: 'desc' }, { installedAt: 'desc' }],
            take: 1,
            include: { hall: true },
          },
        },
        orderBy: [{ major: 'asc' }, { minor: 'asc' }],
      }),
      prisma.hall.findMany({
        where: { congressId: filter.congressId, hallBeacons: { none: {} } },
      }),
      prisma.beaconObservation.groupBy({
        by: ['beaconId'],
        where: {
          congressId: filter.congressId,
          beaconId: { not: null },
          observedAt: { gte: filter.from, lte: filter.to },
        },
        _count: { _all: true },
      }),
      prisma.beaconObservation.groupBy({
        by: ['beaconId'],
        where: {
          congressId: filter.congressId,
          beaconId: { not: null },
          observedAt: { gte: filter.from, lte: filter.to },
          rssi: { lt: 0 },
        },
        _avg: { rssi: true },
      }),
    ]);

  const countMap = new Map(
    observationStats.map((row) => [row.beaconId, row._count._all]),
  );
  const rssiMap = new Map(
    rssiStats.map((row) => [row.beaconId, row._avg.rssi]),
  );

  for (const beacon of beacons) {
    const atama = beacon.hallBeacons[0] ?? null;
    const ortalamaRssi = rssiMap.get(beacon.id) ?? null;

    const row = worksheet.addRow({
      beaconId: beacon.id,
      uuid: beacon.uuid,
      major: beacon.major,
      minor: beacon.minor,
      etiket: beacon.label ?? '',
      salon: atama?.hall.name ?? '',
      hallId: atama?.hallId ?? '',
      kapasite: atama?.hall.capacity ?? '',
      salonEsigi: atama?.hall.rssiThreshold ?? '',
      beaconEsigi: atama?.rssiThreshold ?? '',
      aktifMi: atama?.isActive ? 1 : 0,
      kurulumTarihi: atama ? toIstanbulWallClockDate(atama.installedAt) : '',
      kaldirilmaTarihi: atama?.removedAt
        ? toIstanbulWallClockDate(atama.removedAt)
        : '',
      kalibrasyonNotu: atama?.calibrationNote ?? '',
      yerlesimNotu: atama?.placementNote ?? '',
      okumaSayisi: countMap.get(beacon.id) ?? 0,
      ortalamaRssi:
        ortalamaRssi !== null ? Math.round(ortalamaRssi * 100) / 100 : '',
    });
    row.commit();
  }

  for (const hall of hallsWithoutBeacon) {
    const row = worksheet.addRow({
      beaconId: '',
      uuid: '',
      major: '',
      minor: '',
      etiket: '(beacon atanmamış)',
      salon: hall.name,
      hallId: hall.id,
      kapasite: hall.capacity ?? '',
      salonEsigi: hall.rssiThreshold,
      beaconEsigi: '',
      aktifMi: '',
      kurulumTarihi: '',
      kaldirilmaTarihi: '',
      kalibrasyonNotu: '',
      yerlesimNotu: '',
      okumaSayisi: '',
      ortalamaRssi: '',
    });
    row.commit();
  }

  if (beacons.length === 0 && hallsWithoutBeacon.length === 0) {
    writeEmptyNotice(worksheet, 'Bu kongrede henüz beacon/salon yok.');
  }

  worksheet.commit();
  return beacons.length + hallsWithoutBeacon.length;
}
