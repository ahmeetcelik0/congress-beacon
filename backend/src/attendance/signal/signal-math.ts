// Salon tespit algoritmasi v3'un saf matematik katmani: Hampel outlier
// filtresi (Katman 1), EMA yumusatma (Katman 2) ve softmax guven yuzdesi
// (Katman 4). Hicbir I/O yok, hicbir bagimlilik yok - dogrudan birim testi
// yazilabilsin diye bilincli olarak servisten ayri tutuldu.

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Median Absolute Deviation - medyandan sapmalarin medyani. Standart sapmadan
// farkli olarak tek bir uc degerden etkilenmez, bu yuzden outlier tespitinde
// kullaniliyor.
export function medianAbsoluteDeviation(values: number[], med: number): number {
  return median(values.map((value) => Math.abs(value - med)));
}

// Yeni okuma, son olcumlerden olusan pencereye gore "suruden kopmus" mu?
export function isHampelOutlier(
  value: number,
  window: number[],
  k: number,
  windowSize: number,
): boolean {
  // Pencere dolmadan karar veremeyiz: az sayida ornekle hesaplanan medyan/MAD
  // guvenilir degil, gercek okumalari yanlislikla elemeye baslardi.
  if (window.length < windowSize) {
    return false;
  }

  const med = median(window);
  const mad = medianAbsoluteDeviation(window, med);

  // MAD = 0 durumu: telefon sabit dururken RSSI ayni degere kuantalanir ve
  // pencere tamamen ayni sayilardan olusur. Bu durumda "|x - medyan| > k * 0"
  // kurali medyandan 1 dB bile farkli HER okumayi reddeder ve filtre kalici
  // olarak kilitlenir. Bu yuzden MAD sifirken filtre devre disi birakilir.
  if (mad === 0) {
    return false;
  }

  return Math.abs(value - med) > k * mad;
}

// EMA(t) = alpha * RSSI(t) + (1 - alpha) * EMA(t-1); ilk okumada EMA(0) = RSSI(0).
// Adaptif (KAMA-tarzi) alpha bu surumde bilincli olarak YOK - sabit alpha yeterli.
export function nextEma(
  previous: number | null,
  value: number,
  alpha: number,
): number {
  if (previous === null) {
    return value;
  }
  return alpha * value + (1 - alpha) * previous;
}

// Salonlarin yumusatilmis ortalamalarini, toplami 100 olan guven yuzdelerine
// cevirir: P(h) = exp(ortalama(h) / T) / toplam_j exp(ortalama(j) / T).
//
// DIKKAT: Bu yuzde "sinyal kalitesi" DEGIL, "salonlar arasi gorecelik"
// olcer. Yalnizca tek salon goruluyorsa sonuc, sinyal -95 dBm bile olsa
// %100 cikar. Gercek koruma her zaman Hall.rssiThreshold kapisidir.
export function softmaxPercentages(
  means: Map<string, number>,
  temperature: number,
): Map<string, number> {
  const result = new Map<string, number>();
  if (means.size === 0) {
    return result;
  }

  // Sifir/negatif sicaklik matematiksel olarak tanimsiz; DTO tarafinda
  // engelleniyor, burada yine de savunmaci bir taban var.
  const t = Math.max(temperature, 0.0001);

  // Log-sum-exp: en buyuk degeri cikararak ussel almak matematiksel olarak
  // ayni sonucu verir ama cok negatif RSSI'larda (ornegin -100 dBm) alt
  // tasmayi (underflow) onler.
  const values = [...means.values()];
  const max = Math.max(...values);

  let sum = 0;
  const exps = new Map<string, number>();
  for (const [hallId, mean] of means) {
    const value = Math.exp((mean - max) / t);
    exps.set(hallId, value);
    sum += value;
  }

  for (const [hallId, value] of exps) {
    result.set(hallId, (value / sum) * 100);
  }

  return result;
}
