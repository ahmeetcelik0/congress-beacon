// Faz 4d: kanonik semada her gunun kendi tarihi ZORUNLUDUR (bkz.
// shared/congress-program.schema.json `days[].date`) - Faz 4b/4c'nin
// "tarih opsiyonel, kongre baslangicindan gun SIRASINA gore INDEX bazli
// turet" modeli (eski `buildDayDateMap`/`resolveDayDate`) bu yuzden
// GEREKSIZ hale geldi ve KALDIRILDI (bkz. docs/decisions.md "Faz 4d").
// Burada yalnizca saat/tarih metinlerini gercek Date nesnelerine ceviren
// SAF yardimcilar kalir.
//
// Faz 12: `new Date(y, m, d)` + `setHours()` KALDIRILDI - ikisi de
// sunucunun CALISTIGI ortamin yerel saatini varsayiyordu (Docker'da
// TZ ayarlanmadiginda UTC, gelistirmede Turkiye saati - ayni girdi iki
// farkli UTC Date uretiyordu). Artik gun bilgisi saat ile birlesene
// kadar HIC Date nesnesine cevrilmiyor - `parseCanonicalDate` sadece
// bicimi dogrulayip STRING olarak geri donuyor, gercek donusum
// `combineDateAndTime` icinde `congress-time.ts`'deki tek yetkili
// yardimciyla (Intl/IANA uzerinden) yapiliyor (bkz. docs/decisions.md
// "Faz 12").

import { combineIstanbulDateTime } from '../../common/congress-time';

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const [, year, month, day] = match;
  const probe = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  return !Number.isNaN(probe.getTime());
}

// `validate-extraction-result.ts` (AJV `pattern` kisiti) zaten `date`
// bicimini garanti eder - bu fonksiyon yine de `null` donebilir (savunma
// amacli), cagiran taraf (write-extraction-to-staging.ts) her zaman
// GECERLI veri bekledigi icin pratikte hic tetiklenmez.
export function parseCanonicalDate(value: string): string | null {
  const trimmed = value.trim();
  return isValidIsoDate(trimmed) ? trimmed : null;
}

/** "YYYY-MM-DD" gun tarihi + "HH:MM" saat metnini Turkiye saatinde
 * birlestirip GERCEK UTC DateTime uretir (bkz. `congress-time.ts`). */
export function combineDateAndTime(
  dateStr: string,
  rawTime: string,
): Date | null {
  return combineIstanbulDateTime(dateStr, rawTime);
}

// `validate-extraction-result.ts` (zaman sirasi kontrolu) ve
// `write-extraction-to-staging.ts` (cakisan etkinlik uyarisi) AYNI
// "HH:MM -> gunun kacinci dakikasi" donusumune ihtiyac duyar - tek kaynak
// burasi. Gecerli "HH:MM" varsayar (cagiran taraf AJV/`parseTimeOfDay` ile
// zaten dogrulamis olmali).
export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
