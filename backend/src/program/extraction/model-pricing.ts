// Tek sabit fiyat tablosu - maliyet hesabi kodun baska hicbir yerine
// dagitilmaz (bkz. docs/decisions.md, Faz 4b). Anthropic'in resmi LISTE
// fiyatlari kullanilir (tanitim/indirimli fiyat DEGIL) - kullanicinin $5
// kredisi sinirli oldugu icin tahmin her zaman muhafazakar (yuksek) tarafta
// kalmali. $ / 1M token.
export const MODEL_PRICING: Record<
  string,
  { inputPerMTok: number; outputPerMTok: number }
> = {
  'claude-opus-4-8': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-sonnet-5': { inputPerMTok: 3, outputPerMTok: 15 },
};

export function getModelPricing(
  model: string,
): { inputPerMTok: number; outputPerMTok: number } | null {
  return MODEL_PRICING[model] ?? null;
}

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = getModelPricing(model);
  if (!pricing) return null;
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMTok +
    (outputTokens / 1_000_000) * pricing.outputPerMTok
  );
}
