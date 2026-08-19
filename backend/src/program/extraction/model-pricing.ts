// Tek sabit fiyat tablosu - maliyet hesabi kodun baska hicbir yerine
// dagitilmaz (bkz. docs/decisions.md, Faz 4b). Anthropic'in resmi LISTE
// fiyatlari kullanilir (tanitim/indirimli fiyat DEGIL - TEK istisna asagida
// aciklanan claude-sonnet-5 tanitim donemi) - kullanicinin $5 kredisi
// sinirli oldugu icin tahmin her zaman muhafazakar (yuksek) tarafta
// kalmali. $ / 1M token.
//
// BU TABLO ELLE GUNCELLENMESI GEREKEN BIR KAYNAKTIR. Anthropic fiyatlari
// degistirdiginde veya bir tanitim donemi bittiginde burasi kod
// degisikligiyle guncellenmeli - otomatik cekilen bir kaynaktan gelmiyor.
// Dogrulama: Anthropic'in resmi fiyatlandirma sayfasi (anthropic.com/pricing)
// veya API dokumantasyonundaki guncel model fiyat tablosu.
type PricingRule = {
  inputPerMTok: number;
  outputPerMTok: number;
  // Tanimliysa: bu tarihten (UTC, dahil degil) ITIBAREN artik GECERSIZ -
  // yani kural yalnizca `asOf < validUntil` oldugunda uygulanir. Tanimsizsa
  // kalici/varsayilan fiyattir (listedeki SON kural olmali).
  validUntil?: Date;
};

// claude-sonnet-5: 2026-08-31'in SONUNA kadar (2026-09-01 00:00 UTC'den
// once) $2/$10 tanitim fiyati gecerli, sonrasinda resmi liste fiyati
// $3/$15'e doner (bkz. Faz 5 talimati - onceki tabloda tanitim fiyati hic
// yoktu, bu yuzden Sonnet gercek maliyetinden %50 pahali gorunup Faz 4b'nin
// model karsilastirmasini yanlislamisti).
const SONNET_5_PROMO_ENDS_AT = new Date('2026-09-01T00:00:00.000Z');

export const MODEL_PRICING: Record<string, PricingRule[]> = {
  'claude-opus-4-8': [{ inputPerMTok: 5, outputPerMTok: 25 }],
  'claude-sonnet-5': [
    { inputPerMTok: 2, outputPerMTok: 10, validUntil: SONNET_5_PROMO_ENDS_AT },
    { inputPerMTok: 3, outputPerMTok: 15 },
  ],
};

export function getModelPricing(
  model: string,
  asOf: Date = new Date(),
): { inputPerMTok: number; outputPerMTok: number } | null {
  const rules = MODEL_PRICING[model];
  if (!rules || rules.length === 0) return null;

  const active = rules.find(
    (rule) => !rule.validUntil || asOf < rule.validUntil,
  );
  const rule = active ?? rules[rules.length - 1];
  return { inputPerMTok: rule.inputPerMTok, outputPerMTok: rule.outputPerMTok };
}

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  asOf: Date = new Date(),
): number | null {
  const pricing = getModelPricing(model, asOf);
  if (!pricing) return null;
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMTok +
    (outputTokens / 1_000_000) * pricing.outputPerMTok
  );
}
