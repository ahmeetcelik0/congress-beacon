// Faz 12: kongre saat dilimi tutarlılığı - panelin TEK yetkili zaman
// yardımcısı. Elde yazılmış onlarca `formatDateTime`/`toLocaleString`
// çağrısının yerini alır (bkz. docs/decisions.md "Faz 12") - hiçbir
// server/client component KENDİ format fonksiyonunu yazmaz, hepsi buradan
// gelir.
//
// `CONGRESS_TIME_ZONE` backend'deki `backend/src/common/congress-time.ts`
// ile AYNI değeri taşır (Europe/Istanbul) - iki proje ayrı paket olduğu
// için import EDİLEMİYOR, bu yüzden sabit burada da tekrarlanıyor. İkisi
// değiştirilecekse birlikte değiştirilmelidir.
export const CONGRESS_TIME_ZONE = 'Europe/Istanbul';

// Türkiye 2016'dan beri kalıcı UTC+3 uyguluyor, yaz saati DEĞİŞTİRMİYOR -
// yine de sabit +3 saat KODA GÖMÜLMEDİ, `Intl` üzerinden IANA saat dilimi
// veritabanından hesaplanıyor (bkz. backend'deki aynı isimli fonksiyonun
// gerekçesi).
function istanbulOffsetMinutesAt(utcMs: number): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CONGRESS_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(utcMs));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return (asIfUtc - utcMs) / 60000;
}

// --- YAZMA: <input type="datetime-local"> değeri -> UTC ISO metni ---

/**
 * `<input type="datetime-local">`den gelen "2026-09-01T15:00" (Türkiye
 * saatinde, saat dilimsiz) metnini gerçek UTC ISO metnine çevirir. Server
 * action'larda `new Date(value).toISOString()` DOĞRUDAN KULLANILMAZ -
 * Node'un `new Date('2026-09-01T15:00')` çağrısı, çalıştığı sürecin (Docker
 * konteynerinde production'da UTC) yerel saatini varsayar, geliştirmede
 * (Türkiye saati) ile FARKLI sonuç üretirdi (bkz. docs/decisions.md
 * "Faz 12").
 */
export function datetimeLocalToIso(value: string): string {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offsetMinutes = istanbulOffsetMinutesAt(naiveUtcMs);
  return new Date(naiveUtcMs - offsetMinutes * 60000).toISOString();
}

/**
 * `datetimeLocalToIso`nun boş-değer-güvenli hâli - form alanı boş
 * bırakıldığında `undefined` döner (backend DTO'ları `dto.startTime !==
 * undefined` ile "değiştirme" kararını verir; boş string göndermek
 * `new Date('')` [Invalid Date] hatasına yol açar - bkz. eski
 * `toIsoOrUndefined`, aynı sözleşme burada korunuyor).
 */
export function datetimeLocalToIsoOrUndefined(
  value: FormDataEntryValue | null,
): string | undefined {
  const str = String(value ?? '').trim();
  return str ? datetimeLocalToIso(str) : undefined;
}

// --- OKUMA: UTC ISO metni -> Türkiye saatinde okunabilir gösterim ---

const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: CONGRESS_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const dateTimeWithYearFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: CONGRESS_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dateTimeWithSecondsFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: CONGRESS_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: CONGRESS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});

const timeWithSecondsFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: CONGRESS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/**
 * "21.08 15:00" - gün.ay + saat:dakika. `timeZone: CONGRESS_TIME_ZONE`
 * AÇIKÇA verildiği için sunucu/tarayıcı hangi saat diliminde çalışırsa
 * çalışsın (ya da ikisi FARKLI olsa bile) AYNI sonucu üretir - bir server
 * component ile bir client component'in AYNI kaydı İKİ FARKLI saatte
 * göstermesi sorununu kökten çözer (bkz. docs/decisions.md "Faz 12").
 */
export function formatIstanbulDateTime(iso: string | null): string {
  if (!iso) return '—';
  return dateTimeFormatter.format(new Date(iso));
}

/** "21.08.2026 15:00" - gün.ay.yıl + saat:dakika (yıl gösterilen yerler için). */
export function formatIstanbulDateTimeWithYear(iso: string | null): string {
  if (!iso) return '—';
  return dateTimeWithYearFormatter.format(new Date(iso));
}

/** "21.08 15:00:30" - gün.ay + saat:dakika:saniye (karar izleri gibi hassas zaman damgaları için). */
export function formatIstanbulDateTimeWithSeconds(iso: string | null): string {
  if (!iso) return '—';
  return dateTimeWithSecondsFormatter.format(new Date(iso));
}

/** "15:00" - yalnızca saat:dakika. */
export function formatIstanbulTime(iso: string | null): string {
  if (!iso) return '—';
  return timeFormatter.format(new Date(iso));
}

/** "15:00:30" - saniye dahil (ham gözlem akışı gibi yüksek frekanslı yerler için). */
export function formatIstanbulTimeWithSeconds(iso: string | null): string {
  if (!iso) return '—';
  return timeWithSecondsFormatter.format(new Date(iso));
}

// --- FORM DEĞERİ: UTC ISO metni -> <input type="datetime-local"> değeri ---

const datetimeLocalPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CONGRESS_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Düzenleme formunun `<input type="datetime-local">` alanına değer
 * koyarken kullanılır - `datetimeLocalToIso`nun TAM TERSİ, round-trip
 * garantilidir (aynı saat için ikisi birbirini iptal eder).
 */
export function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const parts = datetimeLocalPartsFormatter.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

// --- GÜN BAZLI (saat taşımayan) alanlar için AYRI fonksiyon ---

/**
 * `Congress.startDate`/`endDate` gibi GÜN BAZLI (saat taşımayan) alanlar
 * için - `combineIstanbulDateTime`/`formatIstanbulDateTime` ile
 * KARIŞTIRILMAMALI. Bu alanlar `<input type="date">` ile gönderilip
 * backend'de `new Date('2026-07-23')` ile UTC gece yarısı olarak
 * saklanıyor - Türkiye saatine çevirmek GÜN KAYDIRABİLİR (ör. UTC gece
 * yarısı Türkiye'de zaten ertesi günün 03:00'ü). Bu yüzden ISO metnin
 * yalnızca İLK 10 KARAKTERİ (`YYYY-MM-DD`) kullanılır, saat dilimi
 * dönüşümüne HİÇ girilmez.
 *
 * `congress-card.tsx` ve `lib/congress-status.ts` ZATEN bu mantığı kendi
 * içlerinde (elle) doğru şekilde uyguluyor - Faz 12 kapsamında BİLİNÇLİ
 * olarak dokunulmadılar (bkz. docs/decisions.md "Faz 12" istisnası). Bu
 * fonksiyon onları BİRLEŞTİRMEK için değil, ileride yeni bir ekranda aynı
 * ihtiyaç çıktığında iki farklı elde-yazılmış kopya daha üretilmesin diye
 * eklendi.
 */
export function formatDateOnly(isoDateOnly: string | null): string {
  if (!isoDateOnly) return '—';
  const [year, month, day] = isoDateOnly.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}
