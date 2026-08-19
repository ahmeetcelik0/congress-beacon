import { foldToAsciiLower } from '../../common/normalize-turkish-name';

export type HallCandidate = { id: string; name: string };

// `normalizeTurkishName`in Turkce karakter katlama yaklasimini yeniden
// kullanir, ama unvan ayiklama YOK (salon adinda unvan kavrami anlamsiz -
// bkz. Faz 4c talimati §3). Tum noktalama/bosluk da atilir (yalnizca
// bosluk sadelestirme DEGIL) - "Salon A" / "Salon-A" / "SALON A" ayni
// normalize sonucuna dusmeli ki hem mevcut eslestirme (`matchHall`) hem de
// otomatik salon olusturma adaylarinin birlestirilmesi (`buildHallCreationCandidates`)
// bunlari AYNI salon olarak gorsun.
export function normalizeHallName(raw: string): string {
  return foldToAsciiLower(raw).replace(/[^a-z0-9]/g, '');
}

/**
 * LLM'in belgede gordugu HAM salon adini (rawHallName), o kongrenin
 * tanimli Hall kayitlariyla kucuk harf + Turkce karakter katlama +
 * bosluk sadelestirmesiyle karsilastirir. Eslesmezse hallId null doner
 * ve panelden elle secim gerektigini belirten bir uyari birakir - LLM'e
 * hallId UYDURTULMAZ (bkz. gorev dagilimi talimati).
 */
export function matchHall(
  rawHallName: string | null,
  halls: HallCandidate[],
): { hallId: string | null; warning: string | null } {
  const trimmed = rawHallName?.trim();
  if (!trimmed) {
    return { hallId: null, warning: 'Salon adı belgede yoktu, panelden seçin' };
  }

  const normalized = normalizeHallName(trimmed);
  const match = halls.find(
    (hall) => normalizeHallName(hall.name) === normalized,
  );
  if (match) {
    return { hallId: match.id, warning: null };
  }
  return { hallId: null, warning: 'Salon eşleşmedi, panelden seçin' };
}

/**
 * Onayda otomatik olusturulacak salon adaylarini uretir (Faz 4c §3).
 * Yalnizca "belgede yazili ama tanimli hicbir Hall'a UYMAYAN" adlar buraya
 * girer - `rawHallName` bos/null olan satirlar (belgede salon adi hic
 * yazmiyordu) BURAYA DAHIL EDILMEZ, cunku o durumda otomatik olusturulacak
 * gercek bir isim yok (bkz. Faz 4c talimati §3, `matchHall`in iki farkli
 * null-hallId durumu). Farkli yazimlar (`normalizeHallName` ayni sonucu
 * uretiyorsa) TEK adaya birlestirilir; goruntulenen isim o grupta ILK
 * gorulen (orijinal) yazimdir.
 */
export function buildHallCreationCandidates(
  rawHallNames: Array<string | null>,
): string[] {
  const canonicalByNormalized = new Map<string, string>();
  for (const raw of rawHallNames) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    const key = normalizeHallName(trimmed);
    if (!canonicalByNormalized.has(key)) {
      canonicalByNormalized.set(key, trimmed);
    }
  }
  return [...canonicalByNormalized.values()];
}
