import type ExcelJS from 'exceljs';
import {
  ENTRY_STREAK_THRESHOLD,
  EXIT_STREAK_THRESHOLD,
} from '../../attendance/presence-transition';
import {
  STALE_AFTER_MS,
  SWEEP_ALGORITHM_VERSION,
} from '../../attendance/stale-visit-sweep.service';
import { ALGORITHM_VERSION } from '../../attendance/attendance-processing.service';
import type { LookupTables } from './lookup-tables';

// Faz 13b: DİKEY liste (kapak sayfasıyla AYNI desen - `setupDataWorksheet`
// KULLANILMAZ, bu sayfa donmuş başlık/autoFilter gerektiren bir VERİ tablosu
// değil). Bu sayfa kritiktir çünkü bu ayarlar PANELDEN değiştirilebilir ve
// AYNI ham veri FARKLI ayarlarla FARKLI sonuç üretir - iki test turunu
// karşılaştırırken ayarların aynı olup olmadığı bilinmeden "algoritma bu
// sefer daha iyi çalıştı" mı yoksa "eşiği değiştirmiştik" mi ayırt edilemez.
export function yazKongreAyarlariSayfasi(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  lookups: LookupTables,
): void {
  const worksheet = workbook.addWorksheet('Kongre Ayarları');
  worksheet.getColumn(1).width = 32;
  worksheet.getColumn(2).width = 16;
  worksheet.getColumn(3).width = 60;

  const baslik = (text: string) => {
    const row = worksheet.addRow([text]);
    row.font = { bold: true, size: 12 };
    row.commit();
  };
  const satir = (ayar: string, deger: string | number, aciklama: string) => {
    const row = worksheet.addRow([ayar, deger, aciklama]);
    row.getCell(1).font = { bold: true };
    row.commit();
  };
  const headerRow = worksheet.addRow(['Ayar', 'Değer', 'Ne işe yarar']);
  headerRow.font = { bold: true };
  headerRow.commit();

  const s = lookups.congressSettings;

  baslik('Kongre kimliği');
  satir('Kongre adı', s.name, 'Bu defterin hangi kongreye ait olduğu.');
  satir('Kongre kodu', s.code, 'Kongrenin kısa/benzersiz kodu.');
  satir(
    'Beacon UUID',
    s.beaconUuid,
    "Bu kongrenin beacon donanımlarını tanıyan ortak kimlik - farklı UUID'li bir beacon bu kongreye ait sayılmaz.",
  );

  baslik('Panelden değiştirilebilir algoritma ayarları');
  satir(
    'Gözlem gönderim aralığı (sn)',
    s.observationIntervalSeconds,
    'Mobil cihazın kaç saniyede bir sunucuya veri göndermesi gerektiği.',
  );
  satir(
    'EMA alfa',
    s.emaAlpha,
    'Sinyal yumuşatmada yeni ölçümün ne kadar ağırlıklı sayılacağı - yüksek değer ani değişimlere daha hızlı tepki verir, ama gürültüye de daha duyarlı olur.',
  );
  satir(
    'Hampel K',
    s.hampelK,
    'Bir RSSI ölçümünün "aykırı değer" (outlier) sayılıp elenmesi için standart sapmadan kaç kat uzak olması gerektiği.',
  );
  satir(
    'Hampel pencere boyutu',
    s.hampelWindowSize,
    'Aykırı değer tespitinde kaç son ölçümün dikkate alınacağı.',
  );
  satir(
    'Güven sıcaklığı (softmax)',
    s.confidenceTemperature,
    'Salonlar arası yüzde karşılaştırmasının ne kadar "keskin" olacağı - düşük değer en güçlü sinyale daha fazla ağırlık verir.',
  );
  satir(
    'Giriş olasılık eşiği (%)',
    s.entryProbabilityThreshold,
    'Bir katılımcının bir salona GİRDİ sayılması için gereken minimum güven yüzdesi.',
  );
  satir(
    'Çıkış olasılık eşiği (%)',
    s.exitProbabilityThreshold,
    'Salonda KALMAK için yeterli olan (girişten daha düşük) minimum güven yüzdesi - bu asimetri sınırda dalgalanan katılımcıyı gereksiz yere içeri/dışarı atmayı önler.',
  );
  satir(
    'Belirsizlik marjı (%)',
    s.ambiguityMarginPct,
    'İki salonun güven yüzdesi birbirine bu kadar yakınsa sistem net bir karar vermez, "belirsiz" sayar.',
  );
  satir(
    'Bayat okuma tolerans süresi (sn)',
    s.staleGraceSeconds,
    'Bir beacon\'dan taze veri gelmese bile son bilinen değerinin ne kadar süre daha "hâlâ geçerli" sayılacağı - kısa süreli sinyal kesintilerinde salonun aniden "kaybolmasını" önler.',
  );

  baslik('Kod içindeki sabitler (panelden değişmez)');
  satir(
    'Giriş ardışık tur eşiği',
    ENTRY_STREAK_THRESHOLD,
    'Bir salona giriş kaydedilmeden önce aynı salonun kaç ardışık ölçümde üst üste kazanması gerektiği.',
  );
  satir(
    'Çıkış ardışık tur eşiği',
    EXIT_STREAK_THRESHOLD,
    'Açık bir ziyaretin kapatılması için salonun kaç ardışık ölçümde eşiği geçmemesi gerektiği.',
  );
  satir(
    'Bayat ziyaret süpürme süresi (sn)',
    STALE_AFTER_MS / 1000,
    'Bir ziyaret bu kadar süredir doğrulanmadıysa arka plan işi onu otomatik kapatır (kişi muhtemelen cihazını kapatmış/uygulamadan çıkmıştır).',
  );
  satir(
    'Karar algoritması sürümü',
    ALGORITHM_VERSION,
    'Bu aralıktaki kararların hangi algoritma sürümüyle üretildiği - farklı sürümler arası güven puanları KARŞILAŞTIRILAMAZ (bkz. Veri Sözlüğü tuzak #2).',
  );
  satir(
    'Bayat süpürme algoritma etiketi',
    SWEEP_ALGORITHM_VERSION,
    'Otomatik kapatılan ziyaretlerin Salon Ziyaretleri sayfasındaki "Kapanış tipi" sütununda nasıl işaretlendiği.',
  );

  worksheet.commit();
}
