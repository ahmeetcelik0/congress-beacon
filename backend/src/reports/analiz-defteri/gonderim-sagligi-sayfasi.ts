import type ExcelJS from 'exceljs';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toIstanbulWallClockDate } from '../../common/congress-time';
import {
  setupDataWorksheet,
  writeEmptyNotice,
  DATETIME_FORMAT,
} from '../excel/worksheet-setup';
import type { LookupTables } from './lookup-tables';
import type { ResolvedFilter } from './resolved-filter';

const PAGE_SIZE = 5000;
const EXCEL_MAX_ROWS = 1_048_576;
const SAFE_MAX_DATA_ROWS = EXCEL_MAX_ROWS - 2;

// Faz 13b: `ObservationBatch`, `Ham Gözlem` ile AYNI cursor'lı sayfalama
// desenini kullanır (bkz. `ham-gozlem-sayfasi.ts` gerekçesi) - büyük bir
// kongrede batch sayısı Excel limitini aşabilir. "Önceki partiden geçen
// süre" AYNI CİHAZ için istendiği (görev tanımı) için LAG SQL window
// fonksiyonu YERİNE `Map<deviceId, Date>` ile Node'da hesaplanır - cursor
// sıralaması `userId,receivedAt` OLDUĞU İÇİN her kullanıcının batch'leri
// (tek ya da çoklu cihaz farketmeksizin) KRONOLOJİK gelir, bu da her
// deviceId'nin "önceki" değerinin cursor SINIRLARI BOYUNCA da doğru
// hesaplanmasını garanti eder - Map boyutu cihaz sayısı kadardır, gözlem
// sayısı kadar DEĞİL, bellek riski oluşturmaz.
export async function yazGonderimSagligiSayfasi(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  prisma: PrismaService,
  filter: ResolvedFilter,
  lookups: LookupTables,
): Promise<number> {
  const worksheet = setupDataWorksheet(workbook, 'Gönderim Sağlığı', [
    { header: 'batchId', key: 'batchId', width: 38 },
    { header: 'clientBatchId', key: 'clientBatchId', width: 38 },
    { header: 'Kullanıcı', key: 'kullanici', width: 22 },
    { header: 'userId', key: 'userId', width: 38 },
    { header: 'deviceId', key: 'deviceId', width: 38 },
    { header: 'Sunucuya varış (TR)', key: 'varis', width: 20 },
    { header: 'Kabul edilen', key: 'kabul', width: 12 },
    { header: 'Yinelenen', key: 'yinelenen', width: 12 },
    { header: 'Reddedilen', key: 'reddedilen', width: 12 },
    { header: 'Önceki partiden geçen süre (sn)', key: 'gecenSure', width: 22 },
    { header: 'Beklenen aralık (sn)', key: 'beklenenAralik', width: 16 },
    { header: 'Sapma (sn)', key: 'sapma', width: 12 },
  ]);
  for (const col of worksheet.columns as ExcelJS.Column[]) {
    if (col.key === 'varis') col.numFmt = DATETIME_FORMAT;
  }

  const where: Prisma.ObservationBatchWhereInput = {
    beaconObservations: { some: { congressId: filter.congressId } },
    receivedAt: { gte: filter.from, lte: filter.to },
    ...(filter.userIds ? { userId: { in: filter.userIds } } : {}),
  };

  const oncekiVaris = new Map<string, Date>();
  const observationIntervalSeconds =
    lookups.congressSettings.observationIntervalSeconds;

  let cursor: string | null = null;
  let yazilan = 0;

  while (true) {
    if (yazilan >= SAFE_MAX_DATA_ROWS) break;
    const take = Math.min(PAGE_SIZE, SAFE_MAX_DATA_ROWS - yazilan);

    const args: Prisma.ObservationBatchFindManyArgs = {
      where,
      orderBy: [{ userId: 'asc' }, { receivedAt: 'asc' }, { id: 'asc' }],
      take,
    };
    if (cursor) {
      args.cursor = { id: cursor };
      args.skip = 1;
    }
    const page = await prisma.observationBatch.findMany(args);
    if (page.length === 0) break;

    for (const batch of page) {
      const onceki = oncekiVaris.get(batch.deviceId) ?? null;
      const gecenSureSn = onceki
        ? Math.round((batch.receivedAt.getTime() - onceki.getTime()) / 1000)
        : '';
      const sapmaSn =
        onceki && typeof gecenSureSn === 'number'
          ? gecenSureSn - observationIntervalSeconds
          : '';
      oncekiVaris.set(batch.deviceId, batch.receivedAt);

      const row = worksheet.addRow({
        batchId: batch.id,
        clientBatchId: batch.clientBatchId,
        kullanici: lookups.userNames.get(batch.userId) ?? '(bilinmiyor)',
        userId: batch.userId,
        deviceId: batch.deviceId,
        varis: toIstanbulWallClockDate(batch.receivedAt),
        kabul: batch.acceptedCount,
        yinelenen: batch.duplicateCount,
        reddedilen: batch.rejectedCount,
        gecenSure: gecenSureSn,
        beklenenAralik: observationIntervalSeconds,
        sapma: sapmaSn,
      });
      row.commit();
      yazilan++;
    }

    cursor = page[page.length - 1].id;
    if (page.length < take) break;
  }

  if (yazilan === 0) {
    writeEmptyNotice(worksheet, 'Bu aralıkta kayıt yok.');
  }

  worksheet.commit();
  return yazilan;
}
