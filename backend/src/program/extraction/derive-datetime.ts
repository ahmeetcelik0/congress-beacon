export type ExtractedDay = { label: string; date: string | null };

export type DayDateInfo = { date: Date | null; derived: boolean };

/**
 * LLM'in ustteki `days[]` listesini (gun etiketi -> varsa tarih) gercek
 * Date nesnelerine cevirir. Bir gunun tarihi belgede yoksa, kongrenin
 * `startDate`'inden GUN SIRASINA gore turetilir (1. gun -> startDate,
 * 2. gun -> startDate+1, ...). Kongrenin startDate'i de yoksa o gun icin
 * tarih hesaplanamaz (null kalir, cagiran taraf uyari birakir).
 */
export function buildDayDateMap(
  days: ExtractedDay[],
  congressStartDate: Date | null,
): Map<string, DayDateInfo> {
  const map = new Map<string, DayDateInfo>();

  days.forEach((day, index) => {
    if (day.date) {
      const parsed = parseIsoDate(day.date);
      if (parsed) {
        map.set(day.label, { date: parsed, derived: false });
        return;
      }
    }

    if (congressStartDate) {
      const derived = new Date(congressStartDate);
      derived.setDate(derived.getDate() + index);
      map.set(day.label, { date: derived, derived: true });
      return;
    }

    map.set(day.label, { date: null, derived: false });
  });

  return map;
}

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

// Faz 4c: elle hazirlanan JSON'da saat/tarih biçimi bozuk olabilir (LLM
// çıktısında bu OLMAZ, `output_config.format` zorunlu kılar) -
// `validate-extraction-result.ts` bu iki fonksiyonu kullanarak "hatalı saat
// biçimi" gibi konumlu, Türkçe hatalar üretir. Ayrıştırma mantığı TEK yerde
// (yukarıdaki `parseIsoDate`/`parseTimeOfDay`) kalır, burada TEKRAR
// YAZILMAZ.
export function isValidDateFormat(value: string): boolean {
  return parseIsoDate(value) !== null;
}

export function isValidTimeFormat(value: string): boolean {
  return parseTimeOfDay(value) !== null;
}

export function resolveDayDate(
  dayLabel: string | null,
  dayDateMap: Map<string, DayDateInfo>,
): DayDateInfo {
  if (!dayLabel) return { date: null, derived: false };
  return dayDateMap.get(dayLabel) ?? { date: null, derived: false };
}

/** "HH:MM" + bir gun tarihini birlestirip tam bir DateTime uretir. */
export function combineDateAndTime(
  date: Date | null,
  rawTime: string | null,
): Date | null {
  if (!date || !rawTime) return null;
  const time = parseTimeOfDay(rawTime);
  if (!time) return null;

  const result = new Date(date);
  result.setHours(time.hours, time.minutes, 0, 0);
  return result;
}
