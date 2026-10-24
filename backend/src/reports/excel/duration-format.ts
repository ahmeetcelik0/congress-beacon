// Faz 13a: süre için ÇİFT sütun deseni - sayı (dakika, Excel'de toplama/
// hesap yapılabilsin diye) + okunabilir metin ("1 sa 23 dk", göz atarken
// hızlı okunsun diye). İkisi de AYNI kaynaktan (dakika) üretilir, tek
// yerde tutulur - panelin `hall-visits-table.tsx`teki `formatDuration`ı
// ile AYNI mantık, ama Excel'e yazılacağı için (JSX değil) burada ayrı.
export function formatDurationMinutesReadable(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) {
    return `${minutes} dk`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours} sa ${remainder} dk` : `${hours} sa`;
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}
