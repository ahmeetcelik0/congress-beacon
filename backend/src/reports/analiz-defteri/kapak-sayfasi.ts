import type ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { toIstanbulWallClockDate } from '../../common/congress-time';
import type { LookupTables } from './lookup-tables';
import type { ResolvedFilter } from './resolved-filter';
import type { HamGozlemSonuc } from './ham-gozlem-sayfasi';
import { buildWhere } from './ham-gozlem-sayfasi';

const ALGORITHM_VERSION = 'v3';
const GECIKME_PENCERESI_MS = 60 * 60 * 1000;

export type KapakOzet = {
  congressName: string;
  congressCode: string;
  filter: ResolvedFilter;
  userIdsLabel: string;
  hallIdsLabel: string;
  olusturanAdmin: string;
  olusturmaZamani: Date;
  sayfaSatirSayilari: { sayfa: string; satir: number }[];
  // Faz 13b: sayfa seçim kutucukları eklendiğinde Ham Gözlem sayfası
  // KAPATILABİLİR hale geldi - o durumda kesme kontrolü ANLAMSIZDIR, null.
  hamGozlemSonuc: HamGozlemSonuc | null;
  enGecUlasan: Date | null;
  sonBirSaatteGecikmeliSayisi: number;
};

// Faz 13a: Kapak sayfası, DİĞER TÜM sayfalar yazılıp commit edildikten
// SONRA doldurulur (bkz. `analiz-defteri.service.ts` orkestrasyonu) -
// ExcelJS WorkbookWriter'ın akış modunda bir worksheet'in `addWorksheet`
// çağrısı ile "geç doldurma" arasında sorun OLMADIĞI gerçek bir dosya
// üretilip XML'i incelenerek doğrulandı (bkz. docs/decisions.md
// "Faz 13a"). Bu fonksiyon SADECE toplanan özet bilgiyi hücrelere yazar,
// sorgu yapmaz - `collectKapakOzet` sorguları yapar.
export async function collectKapakOzet(
  prisma: PrismaService,
  filter: ResolvedFilter,
  lookups: LookupTables,
  olusturanAdmin: string,
  hamGozlemSonuc: HamGozlemSonuc | null,
  sayfaSatirSayilari: { sayfa: string; satir: number }[],
): Promise<KapakOzet> {
  const congress = await prisma.congress.findUniqueOrThrow({
    where: { id: filter.congressId },
    select: { name: true, code: true },
  });

  const where = buildWhere(filter);
  // "Bu aralıktaki kayıtların en geç ULAŞANI" - serverReceivedAt üzerinden
  // (sunucuya varış), observedAt DEĞİL. Çevrimdışı kuyruktan gelen veri
  // saatler sonra ulaşabildiği için raporun ne kadar "taze" olduğunu bu
  // gösterir (bkz. görev tanımı §3 Kapak sayfası).
  const enGecUlasan = await prisma.beaconObservation.aggregate({
    where,
    _max: { serverReceivedAt: true },
  });

  // "Son bir saatte ulaşan gecikmeli kayıt sayısı" - RAPOR OLUŞTURULMA
  // ANINA göre son 1 saat içinde sunucuya ulaşmış (ama ölçüm zamanı
  // filtre aralığında olan) kayıtlar. Bu sayı YÜKSEKSE veri HÂLÂ
  // akıyordur - rapor eksik olabilir, bu yüzden kapakta AÇIKÇA yazılır.
  const now = new Date();
  const sonBirSaatteGecikmeliSayisi = await prisma.beaconObservation.count({
    where: {
      ...where,
      serverReceivedAt: { gte: new Date(now.getTime() - GECIKME_PENCERESI_MS) },
    },
  });

  const userIdsLabel = filter.userIds
    ? filter.userIds.map((id) => lookups.userNames.get(id) ?? id).join(', ')
    : 'Tümü';
  const hallIdsLabel = filter.hallIds
    ? filter.hallIds.map((id) => lookups.hallNames.get(id) ?? id).join(', ')
    : 'Tümü';

  return {
    congressName: congress.name,
    congressCode: congress.code,
    filter,
    userIdsLabel,
    hallIdsLabel,
    olusturanAdmin,
    olusturmaZamani: now,
    sayfaSatirSayilari,
    hamGozlemSonuc,
    enGecUlasan: enGecUlasan._max.serverReceivedAt,
    sonBirSaatteGecikmeliSayisi,
  };
}

export function yazKapakSayfasi(
  worksheet: ExcelJS.Worksheet,
  ozet: KapakOzet,
): void {
  worksheet.getColumn(1).width = 34;
  worksheet.getColumn(2).width = 60;

  const baslik = (text: string) => {
    const row = worksheet.addRow([text]);
    row.font = { bold: true, size: 13 };
    row.commit();
  };
  const satir = (label: string, value: string | number) => {
    const row = worksheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    row.commit();
  };
  const bosSatir = () => worksheet.addRow([]).commit();
  const uyari = (text: string) => {
    const row = worksheet.addRow([text]);
    row.font = { bold: true, color: { argb: 'FFB45309' } };
    row.commit();
  };

  baslik('Beacon Analiz Defteri');
  satir('Kongre', `${ozet.congressName} (${ozet.congressCode})`);
  bosSatir();

  baslik('Uygulanan filtreler');
  satir(
    'Tarih-saat aralığı (TR)',
    `${formatTr(toIstanbulWallClockDate(ozet.filter.from))} – ${formatTr(toIstanbulWallClockDate(ozet.filter.to))}`,
  );
  satir('Kullanıcılar', ozet.userIdsLabel);
  satir('Salonlar', ozet.hallIdsLabel);
  bosSatir();

  baslik('Rapor bilgisi');
  satir('Oluşturan yetkili', ozet.olusturanAdmin);
  satir(
    'Oluşturulma zamanı (TR)',
    formatTr(toIstanbulWallClockDate(ozet.olusturmaZamani)),
  );
  satir('Algoritma sürümü', ALGORITHM_VERSION);
  bosSatir();

  baslik('Sayfa bazında satır sayısı');
  for (const { sayfa, satir: adet } of ozet.sayfaSatirSayilari) {
    satir(sayfa, adet);
  }
  bosSatir();

  baslik('Saat dilimi notu');
  const notRow = worksheet.addRow([
    'Tüm saatler Türkiye saatidir. Veritabanı UTC saklar, fark 3 saattir.',
  ]);
  notRow.commit();
  bosSatir();

  baslik('Eksik veri uyarısı');
  satir(
    'Bu aralıktaki kayıtların en geç ulaşanı',
    ozet.enGecUlasan
      ? formatTr(toIstanbulWallClockDate(ozet.enGecUlasan))
      : 'Kayıt yok',
  );
  satir(
    'Son bir saatte ulaşan gecikmeli kayıt sayısı',
    ozet.sonBirSaatteGecikmeliSayisi,
  );
  if (ozet.sonBirSaatteGecikmeliSayisi > 0) {
    uyari(
      'Bu sayı sıfırdan büyük - veri hâlâ akıyor olabilir, bu rapor eksik kayıt içerebilir. ' +
        'Turdan yeterli süre geçtikten sonra tekrar indirmeniz önerilir.',
    );
  }
  bosSatir();

  if (ozet.hamGozlemSonuc?.kesildi) {
    baslik('Kesme uyarısı');
    uyari(
      `Ham gözlem ${(1_048_576).toLocaleString('tr-TR')} satırda kesildi, ` +
        `toplam ${ozet.hamGozlemSonuc.toplamKayit.toLocaleString('tr-TR')} kayıt var. ` +
        'Daha dar bir tarih-saat aralığı seçip tekrar indirin.',
    );
  }
}

function formatTr(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
  );
}
