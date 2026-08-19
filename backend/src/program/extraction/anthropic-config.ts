const DEFAULT_MODEL = 'claude-opus-4-8';
// Faz 4b canli testinde 25 sayfalik bir kesit 61674 girdi token'ina karsi
// 22395 cikti token'i uretti (~%36 oran) - 100-150 sayfalik gercek belgeler
// icin bu, 64000'i kolayca asabilir ve cikti KESILIP gecersiz JSON'a yol
// acabilir (bkz. docs/decisions.md). Claude Opus 4.8 128K cikti destekler
// (streaming ile, zaten kullaniliyor) - guvenlik payi icin varsayilan
// yukseltildi.
const DEFAULT_MAX_OUTPUT_TOKENS = 128000;

// Model asla koda gomulmez, her zaman env'den okunur - bkz. Faz 4b
// talimati ("Model secimi bu fazin bir ciktisi").
export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

export function getAnthropicMaxOutputTokens(): number {
  const raw = Number(process.env.ANTHROPIC_MAX_OUTPUT_TOKENS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_OUTPUT_TOKENS;
}
