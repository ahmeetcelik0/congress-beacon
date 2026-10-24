import type ExcelJS from 'exceljs';
import { NotificationStatus } from '../../../generated/prisma/client';
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
import type { ResolvedFilter } from './resolved-filter';
import { fetchHallVisitsInRange } from './salon-ziyaretleri-sayfasi';

const ROL_ETIKETI: Record<string, string> = {
  PARTICIPANT: 'Katılımcı',
  ADMIN: 'Yönetici',
};

// Faz 13b: satır: kullanıcı. Diğer sayfaların aksine `lookup-tables.ts`
// KULLANILMAZ - oradaki `userNames` yalnızca AKTİF kayıtlı kullanıcıları
// içerir (bkz. o dosyadaki gerekçe), bu sayfa ise "Kongre kaydı aktif mi"
// sütununu göstermek için PASİF kayıtları da listelemesi GEREKİYOR. Bu
// yüzden kendi tam `CongressRegistration`+`User` sorgusunu yapar.
export async function yazKatilimcilarSayfasi(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  prisma: PrismaService,
  filter: ResolvedFilter,
): Promise<number> {
  const worksheet = setupDataWorksheet(workbook, 'Katılımcılar', [
    { header: 'Ad Soyad', key: 'adSoyad', width: 22 },
    { header: 'userId', key: 'userId', width: 38 },
    { header: 'E-posta', key: 'eposta', width: 26 },
    { header: 'Telefon', key: 'telefon', width: 16 },
    { header: 'Rol', key: 'rol', width: 12 },
    { header: 'Kongre kaydı aktif mi', key: 'kayitAktif', width: 14 },
    { header: 'Cihaz sayısı', key: 'cihazSayisi', width: 12 },
    { header: 'İlk görülme (TR)', key: 'ilkGorulme', width: 20 },
    { header: 'Son görülme (TR)', key: 'sonGorulme', width: 20 },
    { header: 'Toplam gözlem sayısı', key: 'gozlemSayisi', width: 16 },
    { header: 'Toplam ziyaret sayısı', key: 'ziyaretSayisi', width: 16 },
    { header: 'Toplam süre (dk)', key: 'sureNumeric', width: 14 },
    { header: 'Toplam süre', key: 'sureOkunabilir', width: 14 },
    {
      header: 'Gönderilen bildirim sayısı',
      key: 'bildirimGonderilen',
      width: 18,
    },
    { header: 'Açılan bildirim sayısı', key: 'bildirimAcilan', width: 16 },
  ]);
  for (const col of worksheet.columns as ExcelJS.Column[]) {
    if (col.key === 'ilkGorulme' || col.key === 'sonGorulme')
      col.numFmt = DATETIME_FORMAT;
  }

  const registrations = await prisma.congressRegistration.findMany({
    where: {
      congressId: filter.congressId,
      ...(filter.userIds ? { userId: { in: filter.userIds } } : {}),
    },
    select: {
      userId: true,
      isActive: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phoneRaw: true,
          role: true,
        },
      },
    },
    orderBy: { user: { firstName: 'asc' } },
  });

  if (registrations.length === 0) {
    writeEmptyNotice(worksheet, 'Bu aralıkta kayıt yok.');
    worksheet.commit();
    return 0;
  }

  const userIds = registrations.map((r) => r.userId);

  const [deviceCounts, observationStats, visits, notificationCounts] =
    await Promise.all([
      prisma.device.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      prisma.beaconObservation.groupBy({
        by: ['userId'],
        where: {
          congressId: filter.congressId,
          userId: { in: userIds },
          observedAt: { gte: filter.from, lte: filter.to },
        },
        _count: { _all: true },
        _min: { observedAt: true },
        _max: { observedAt: true },
      }),
      // Ziyaret sayısı/süresi, orijinal filtrenin hallIds'ine de saygı
      // duyar - kullanıcı belirli bir salon seçtiyse Katılımcılar sayfası
      // da o salondaki ziyaretleri saymalı.
      fetchHallVisitsInRange(prisma, { ...filter, userIds }),
      prisma.notificationLog.groupBy({
        by: ['userId', 'status'],
        where: {
          congressId: filter.congressId,
          userId: { in: userIds },
          sentAt: { gte: filter.from, lte: filter.to },
        },
        _count: { _all: true },
      }),
    ]);

  const deviceCountMap = new Map(
    deviceCounts.map((d) => [d.userId, d._count._all]),
  );
  const obsStatsMap = new Map(observationStats.map((o) => [o.userId, o]));

  const visitStatsMap = new Map<string, { sayi: number; toplamSure: number }>();
  for (const visit of visits) {
    const sure = minutesBetween(
      visit.startedAt,
      visit.endedAt ?? visit.lastConfirmedAt,
    );
    const existing = visitStatsMap.get(visit.userId) ?? {
      sayi: 0,
      toplamSure: 0,
    };
    existing.sayi++;
    existing.toplamSure += sure;
    visitStatsMap.set(visit.userId, existing);
  }

  const sentMap = new Map<string, number>();
  const openedMap = new Map<string, number>();
  for (const row of notificationCounts) {
    if (row.status === NotificationStatus.SENT) {
      sentMap.set(row.userId, (sentMap.get(row.userId) ?? 0) + row._count._all);
    }
  }
  // Açılma, sentAt aralığındaki TÜM loglar üzerinden (openedAt dolu olanlar)
  // ayrıca sayılır - `groupBy(['userId','status'])` açılma bilgisini
  // TAŞIMAZ (status alanı SENT/FAILED/SKIPPED'tir, açılma AYRI bir alan).
  const openedCounts = await prisma.notificationLog.groupBy({
    by: ['userId'],
    where: {
      congressId: filter.congressId,
      userId: { in: userIds },
      sentAt: { gte: filter.from, lte: filter.to },
      openedAt: { not: null },
    },
    _count: { _all: true },
  });
  for (const row of openedCounts) {
    openedMap.set(row.userId, row._count._all);
  }

  for (const reg of registrations) {
    const obs = obsStatsMap.get(reg.userId);
    const visitStats = visitStatsMap.get(reg.userId) ?? {
      sayi: 0,
      toplamSure: 0,
    };

    const row = worksheet.addRow({
      adSoyad: `${reg.user.firstName} ${reg.user.lastName}`,
      userId: reg.userId,
      eposta: reg.user.email ?? '',
      telefon: reg.user.phoneRaw ?? '',
      rol: ROL_ETIKETI[reg.user.role] ?? reg.user.role,
      kayitAktif: reg.isActive ? 1 : 0,
      cihazSayisi: deviceCountMap.get(reg.userId) ?? 0,
      ilkGorulme: obs?._min.observedAt
        ? toIstanbulWallClockDate(obs._min.observedAt)
        : '',
      sonGorulme: obs?._max.observedAt
        ? toIstanbulWallClockDate(obs._max.observedAt)
        : '',
      gozlemSayisi: obs?._count._all ?? 0,
      ziyaretSayisi: visitStats.sayi,
      sureNumeric: visitStats.toplamSure,
      sureOkunabilir: formatDurationMinutesReadable(visitStats.toplamSure),
      bildirimGonderilen: sentMap.get(reg.userId) ?? 0,
      bildirimAcilan: openedMap.get(reg.userId) ?? 0,
    });
    row.commit();
  }

  worksheet.commit();
  return registrations.length;
}
