/**
 * Beş içerik türünün de "yukarı/aşağı" sıralama butonları AYNI hesaplamayı
 * yapar: tıklanan satırı komşusuyla yer değiştirip, listedeki TÜM id'leri
 * yeni sırayla döndürür — `POST /admin/<tür>/reorder` id dizisinin sırasına
 * göre `displayOrder`'ı 0'dan yeniden yazdığı için istek TEK seferde TÜM
 * listeyi içermelidir (bkz. görev tanımı).
 */
export function computeReorderedIds<T extends { id: string }>(
  items: T[],
  index: number,
  direction: 'up' | 'down',
): string[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) {
    return items.map((item) => item.id);
  }

  const next = [...items];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next.map((item) => item.id);
}
