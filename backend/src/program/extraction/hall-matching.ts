import { foldToAsciiLower } from '../../common/normalize-turkish-name';

export type HallCandidate = { id: string; name: string };

function normalizeHallName(raw: string): string {
  return foldToAsciiLower(raw).replace(/\s+/g, ' ').trim();
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
