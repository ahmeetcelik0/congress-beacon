// Faz 12: kongre saat dilimi tutarlılığı.
//
// Kongre kaydına zaman dilimi alanı EKLENMEDİ (bilinçli karar, bkz.
// docs/decisions.md "Faz 12") - bugünkü ihtiyaç tek ülkede (Türkiye), daha
// az hareketli parça. Sabit tek bir yerde tanımlanıyor ki ileride kongre
// bazlı ayara çevrilmek istenirse tek satır değişsin.
export const CONGRESS_TIME_ZONE = 'Europe/Istanbul';

// Türkiye 2016'dan beri kalıcı UTC+3 uyguluyor, yaz saati DEĞİŞTİRMİYOR -
// yani teoride offset her zaman sabit +180 dakika. Yine de bu sabiti
// KODA GÖMMÜYORUZ; `Intl` üzerinden IANA saat dilimi veritabanından
// hesaplıyoruz - kural bir gün değişirse (ör. yasa değişikliği) kod
// otomatik uyar, koddaki hiçbir sabit değişmez.
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
  // formatlayıcının ürettiği "İstanbul'da görünen saat" değerlerini
  // TEKRAR UTC olarak yorumlarsak (Date.UTC), aradaki fark GERÇEK
  // offset'tir (dakika, İstanbul UTC'nin kaç dakika ilerisinde).
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

/**
 * "YYYY-MM-DD" + "HH:MM" (İstanbul saatinde, saat dilimsiz metin) -> bu
 * ana karşılık gelen GERÇEK UTC `Date`. Panelden/içe aktarmadan gelen tüm
 * kongre saat girdileri (oturum/sunum başlangıç-bitiş) bu fonksiyondan
 * geçmelidir - `new Date(y, m, d)` veya `setHours()` gibi sunucunun
 * ÇALIŞTIĞI ortamın yerel saatine bağımlı çağrılar KULLANILMAZ (bkz.
 * docs/decisions.md "Faz 12" - Docker'da TZ ayarlanmadığında sunucu UTC
 * çalışıyordu, bu yüzden panelde 15:00 girilen bir saat veritabanına
 * 15:00 UTC olarak (yani gerçekte Türkiye saatiyle 18:00'e karşılık
 * gelecek şekilde) yanlış yazılıyordu).
 *
 * Geçersiz biçimde veya saat/dakika sınır dışıysa `null` döner.
 */
export function combineIstanbulDateTime(
  dateStr: string,
  timeStr: string,
): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!dateMatch || !timeMatch) return null;

  const [, yearStr, monthStr, dayStr] = dateMatch;
  const [, hourStr, minuteStr] = timeMatch;
  const hours = Number(hourStr);
  const minutes = Number(minuteStr);
  if (hours > 23 || minutes > 59) return null;

  // Once "bu saat degerleri sanki UTC'ymis gibi" kaba bir tahmin uretilir,
  // offset o tahmin uzerinden bulunur, sonra gercek UTC hesaplanir. Tek
  // iterasyon yeterlidir cunku Istanbul'un offset'i yil icinde DEGISMEZ
  // (yaz saati yok) - hangi ana baktigimizin sonucu etkilemez.
  const naiveUtcMs = Date.UTC(
    Number(yearStr),
    Number(monthStr) - 1,
    Number(dayStr),
    hours,
    minutes,
    0,
    0,
  );
  if (Number.isNaN(naiveUtcMs)) return null;
  const offsetMinutes = istanbulOffsetMinutesAt(naiveUtcMs);
  return new Date(naiveUtcMs - offsetMinutes * 60000);
}
