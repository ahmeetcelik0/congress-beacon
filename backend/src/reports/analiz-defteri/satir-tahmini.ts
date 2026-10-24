import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildWhere } from './ham-gozlem-sayfasi';
import { fetchHallVisitsInRange } from './salon-ziyaretleri-sayfasi';
import type { ResolvedFilter } from './resolved-filter';
import { sayfaSecili } from './resolved-filter';

const EXCEL_MAX_ROWS = 1_048_576;
// Faz 13a'daki GERÇEK ölçümden türetilen kaba oran: Ham Gözlem sayfası
// 133.191 satır x 19 sütun için sıkıştırılmamış XML'i 121.555.247 byte'tı
// (satır*sütun başına ~48 byte), indirilen (ZIP sıkıştırılmış) dosya ise
// 13.636.857 byte'tı (~9 kat sıkışma). "Kabaca" bir tahmin - kullanıcıya
// dosya çok mu büyük olacak fikrini vermek için, KESİN bir hesap DEĞİL.
const BYTE_PER_HUCRE_SIKISTIRILMAMIS = 48;
const SIKISTIRMA_ORANI = 9;

export type SayfaTahmini = {
  sayfa: string;
  satir: number;
  sutunSayisi: number;
  limitiAsiyorMu: boolean;
};

export type SatirTahminiSonuc = {
  sayfalar: SayfaTahmini[];
  toplamSatir: number;
  tahminiDosyaBoyutuByte: number;
  limitiAsanSayfaVarMi: boolean;
};

// Faz 13b: PANEL "İndir"e basmadan ÖNCE bu uç noktayı çağırır - yalnızca
// SAYIM sorguları çalıştırılır, hiçbir gözlem/ziyaret SATIRI çekilmez. Karar
// Detayı için `JSON_LENGTH` (MySQL 8.0) kullanılır - decisionTrace'in
// `candidates` dizisinin BOYUTUNU veritabanında sayar, JSON'un kendisini
// SUNUCUYA ÇEKMEDEN.
export async function hesaplaSatirTahmini(
  prisma: PrismaService,
  filter: ResolvedFilter,
): Promise<SatirTahminiSonuc> {
  const sayfalar: SayfaTahmini[] = [];

  if (sayfaSecili(filter, 'hamGozlem')) {
    const satir = await prisma.beaconObservation.count({
      where: buildWhere(filter),
    });
    sayfalar.push(ekle('Ham Gözlem', satir, 19));
  }

  if (sayfaSecili(filter, 'dakikaOzeti')) {
    const satir = await dakikaGrupSayisi(prisma, filter);
    sayfalar.push(ekle('Dakika Özeti', satir, 12));
  }

  let attendanceEventSayisi: number | null = null;
  if (sayfaSecili(filter, 'girisCikisOlaylari')) {
    attendanceEventSayisi = await attendanceEventCount(prisma, filter);
    sayfalar.push(ekle('Giriş-Çıkış Olayları', attendanceEventSayisi, 19));
  }
  if (sayfaSecili(filter, 'kararDetayi')) {
    const satir = await kararDetayiSatirSayisi(prisma, filter);
    sayfalar.push(ekle('Karar Detayı', satir, 14));
  }

  let hallVisitSayisi: number | null = null;
  if (sayfaSecili(filter, 'salonZiyaretleri')) {
    hallVisitSayisi = await hallVisitCount(prisma, filter);
    sayfalar.push(ekle('Salon Ziyaretleri', hallVisitSayisi, 14));
  }
  if (sayfaSecili(filter, 'kullaniciSalonOzeti')) {
    const satir = await kullaniciSalonKombinasyonSayisi(prisma, filter);
    sayfalar.push(ekle('Kullanıcı-Salon Özeti', satir, 11));
  }

  if (sayfaSecili(filter, 'cihazVeRssi')) {
    const satir = await cihazVeRssiGrupSayisi(prisma, filter);
    sayfalar.push(ekle('Cihaz ve RSSI', satir, 22));
  }

  if (sayfaSecili(filter, 'gonderimSagligi')) {
    const satir = await gonderimSagligiCount(prisma, filter);
    sayfalar.push(ekle('Gönderim Sağlığı', satir, 12));
  }

  if (sayfaSecili(filter, 'katilimcilar')) {
    const satir = await prisma.congressRegistration.count({
      where: {
        congressId: filter.congressId,
        ...(filter.userIds ? { userId: { in: filter.userIds } } : {}),
      },
    });
    sayfalar.push(ekle('Katılımcılar', satir, 15));
  }

  if (sayfaSecili(filter, 'beaconEnvanteri')) {
    const [beaconSayisi, salonsuzHallSayisi] = await Promise.all([
      prisma.beacon.count({ where: { congressId: filter.congressId } }),
      prisma.hall.count({
        where: { congressId: filter.congressId, hallBeacons: { none: {} } },
      }),
    ]);
    sayfalar.push(
      ekle('Beacon Envanteri', beaconSayisi + salonsuzHallSayisi, 17),
    );
  }

  if (sayfaSecili(filter, 'kongreAyarlari')) {
    // Sabit sayıda ayar satırı - Excel limitini ASLA aşmaz, sayım
    // sorgusuna gerek yok.
    sayfalar.push(ekle('Kongre Ayarları', 16, 3));
  }

  if (sayfaSecili(filter, 'program')) {
    const satir = await prisma.session.count({
      where: {
        congressId: filter.congressId,
        startTime: { lte: filter.to },
        endTime: { gte: filter.from },
        ...(filter.hallIds ? { hallId: { in: filter.hallIds } } : {}),
      },
    });
    sayfalar.push(ekle('Program', satir, 11));
  }

  if (sayfaSecili(filter, 'veriSozlugu')) {
    // Sabit içerik - Excel limitini ASLA aşmaz.
    sayfalar.push(ekle('Veri Sözlüğü', 70, 5));
  }

  const toplamSatir = sayfalar.reduce((acc, s) => acc + s.satir, 0);
  const tahminiDosyaBoyutuByte = sayfalar.reduce(
    (acc, s) =>
      acc +
      (s.satir * s.sutunSayisi * BYTE_PER_HUCRE_SIKISTIRILMAMIS) /
        SIKISTIRMA_ORANI,
    0,
  );

  return {
    sayfalar,
    toplamSatir,
    tahminiDosyaBoyutuByte: Math.round(tahminiDosyaBoyutuByte),
    limitiAsanSayfaVarMi: sayfalar.some((s) => s.limitiAsiyorMu),
  };
}

function ekle(sayfa: string, satir: number, sutunSayisi: number): SayfaTahmini {
  return {
    sayfa,
    satir,
    sutunSayisi,
    limitiAsiyorMu: satir > EXCEL_MAX_ROWS - 2,
  };
}

async function dakikaGrupSayisi(
  prisma: PrismaService,
  filter: ResolvedFilter,
): Promise<number> {
  const beaconFilter = filter.beaconIdsForHallFilter
    ? Prisma.sql`AND beaconId IN (${Prisma.join(filter.beaconIdsForHallFilter)})`
    : Prisma.empty;
  const userFilter = filter.userIds
    ? Prisma.sql`AND userId IN (${Prisma.join(filter.userIds)})`
    : Prisma.empty;

  const result = await prisma.$queryRaw<{ adet: bigint }[]>`
    SELECT COUNT(*) AS adet FROM (
      SELECT DISTINCT userId, beaconId, major, minor,
        DATE_FORMAT(observedAt, '%Y-%m-%d %H:%i:00') AS dakika
      FROM BeaconObservation
      WHERE congressId = ${filter.congressId}
        AND observedAt BETWEEN ${filter.from} AND ${filter.to}
        ${userFilter}
        ${beaconFilter}
    ) t
  `;
  return Number(result[0]?.adet ?? 0);
}

async function attendanceEventCount(
  prisma: PrismaService,
  filter: ResolvedFilter,
): Promise<number> {
  return prisma.attendanceEvent.count({
    where: {
      hall: { congressId: filter.congressId },
      occurredAt: { gte: filter.from, lte: filter.to },
      ...(filter.userIds ? { userId: { in: filter.userIds } } : {}),
      ...(filter.hallIds ? { hallId: { in: filter.hallIds } } : {}),
    },
  });
}

// `candidates` dizisinin toplam boyutu - JSON'un kendisi ÇEKİLMEDEN
// `JSON_LENGTH` ile veritabanında sayılır (bkz. dosya başı yorumu).
async function kararDetayiSatirSayisi(
  prisma: PrismaService,
  filter: ResolvedFilter,
): Promise<number> {
  const userFilter = filter.userIds
    ? Prisma.sql`AND userId IN (${Prisma.join(filter.userIds)})`
    : Prisma.empty;
  const hallFilter = filter.hallIds
    ? Prisma.sql`AND hallId IN (${Prisma.join(filter.hallIds)})`
    : Prisma.empty;

  const result = await prisma.$queryRaw<{ toplam: bigint | null }[]>`
    SELECT SUM(JSON_LENGTH(decisionTrace, '$.candidates')) AS toplam
    FROM AttendanceEvent ae
    JOIN Hall h ON h.id = ae.hallId
    WHERE h.congressId = ${filter.congressId}
      AND ae.occurredAt BETWEEN ${filter.from} AND ${filter.to}
      ${userFilter}
      ${hallFilter}
  `;
  return Number(result[0]?.toplam ?? 0);
}

async function hallVisitCount(
  prisma: PrismaService,
  filter: ResolvedFilter,
): Promise<number> {
  return prisma.hallVisit.count({
    where: {
      hall: { congressId: filter.congressId },
      startedAt: { lte: filter.to },
      OR: [{ endedAt: null }, { endedAt: { gte: filter.from } }],
      ...(filter.userIds ? { userId: { in: filter.userIds } } : {}),
      ...(filter.hallIds ? { hallId: { in: filter.hallIds } } : {}),
    },
  });
}

async function kullaniciSalonKombinasyonSayisi(
  prisma: PrismaService,
  filter: ResolvedFilter,
): Promise<number> {
  // `Kullanıcı-Salon Özeti`, Node'da HallVisit üzerinden türetilir (Faz
  // 13a) - burada da AYNI kaynaktan (tam liste ÇEKMEDEN, sadece kombinasyon
  // sayısı için) tahmin edilir.
  const visits = await fetchHallVisitsInRange(prisma, filter);
  const kombinasyonlar = new Set(visits.map((v) => `${v.userId}|${v.hallId}`));
  return kombinasyonlar.size;
}

async function cihazVeRssiGrupSayisi(
  prisma: PrismaService,
  filter: ResolvedFilter,
): Promise<number> {
  const beaconFilter = filter.beaconIdsForHallFilter
    ? Prisma.sql`AND bo.beaconId IN (${Prisma.join(filter.beaconIdsForHallFilter)})`
    : Prisma.empty;
  const userFilter = filter.userIds
    ? Prisma.sql`AND bo.userId IN (${Prisma.join(filter.userIds)})`
    : Prisma.empty;

  const result = await prisma.$queryRaw<{ adet: bigint }[]>`
    SELECT COUNT(*) AS adet FROM (
      SELECT DISTINCT bo.userId, ob.deviceId, bo.beaconId, bo.major, bo.minor
      FROM BeaconObservation bo
      JOIN ObservationBatch ob ON ob.id = bo.batchId
      WHERE bo.congressId = ${filter.congressId}
        AND bo.observedAt BETWEEN ${filter.from} AND ${filter.to}
        ${userFilter}
        ${beaconFilter}
    ) t
  `;
  return Number(result[0]?.adet ?? 0);
}

async function gonderimSagligiCount(
  prisma: PrismaService,
  filter: ResolvedFilter,
): Promise<number> {
  return prisma.observationBatch.count({
    where: {
      beaconObservations: { some: { congressId: filter.congressId } },
      receivedAt: { gte: filter.from, lte: filter.to },
      ...(filter.userIds ? { userId: { in: filter.userIds } } : {}),
    },
  });
}
