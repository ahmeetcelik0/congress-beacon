/**
 * `content/reorder.ts` ile AYNI hesaplama (bkz. gorev tanimi: cross-module
 * import yapma, kucuk bir kopya yaz) - tiklanan ogeyi komsusuyla yer
 * degistirip, TUM id'leri yeni sirayla dondurur. Sunucudaki `/reorder`
 * uc noktalari gonderilen dizinin sirasina gore `displayOrder`'i 0'dan
 * yeniden yazdigi icin istek TEK seferde ilgili TUM listeyi icermelidir.
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
