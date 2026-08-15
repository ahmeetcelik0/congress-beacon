// Faz 4d: kanonik semada her gunun kendi tarihi ZORUNLUDUR (bkz.
// shared/congress-program.schema.json `days[].date`) - Faz 4b/4c'nin
// "tarih opsiyonel, kongre baslangicindan gun SIRASINA gore INDEX bazli
// turet" modeli (eski `buildDayDateMap`/`resolveDayDate`) bu yuzden
// GEREKSIZ hale geldi ve KALDIRILDI (bkz. docs/decisions.md "Faz 4d").
// Burada yalnizca saat/tarih metinlerini gercek Date nesnelerine ceviren
// SAF yardimcilar kalir.

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTimeOfDay(
  value: string,
): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

// `validate-extraction-result.ts` (AJV `pattern` kisiti) zaten `date`
// bicimini garanti eder - bu fonksiyon yine de `null` donebilir (savunma
// amacli), cagiran taraf (write-extraction-to-staging.ts) her zaman
// GECERLI veri bekledigi icin pratikte hic tetiklenmez.
export function parseCanonicalDate(value: string): Date | null {
  return parseIsoDate(value);
}

/** "HH:MM" + bir gun tarihini birlestirip tam bir DateTime uretir. */
export function combineDateAndTime(date: Date, rawTime: string): Date | null {
  const time = parseTimeOfDay(rawTime);
  if (!time) return null;

  const result = new Date(date);
  result.setHours(time.hours, time.minutes, 0, 0);
  return result;
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
