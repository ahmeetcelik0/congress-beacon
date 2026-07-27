import type { Hall, HallOccupancy } from './api';
import type { StatusTone } from '@/components/ui/status-badge';

/**
 * `/attendance/summary`'nin `hallOccupancy` alanı (anlık kişi sayısı) ile
 * `/halls`'un `capacity` alanı (fiziksel kapasite) FARKLI endpoint'lerden
 * gelir ve backend'de birleştirilmez. Bu, ikisini `hallId` üzerinden
 * istemci tarafında birleştiren SAF fonksiyondur — her ikisi de kongre
 * başına TEK istekle zaten elde edildiği için burada ekstra bir ağ isteği
 * YOKTUR (N+1 riski yok).
 */
export type MergedHallOccupancy = {
  hallId: string;
  hallName: string;
  count: number;
  capacity: number | null;
};

export function mergeHallOccupancyWithCapacity(
  occupancy: HallOccupancy[],
  halls: Pick<Hall, 'id' | 'capacity'>[],
): MergedHallOccupancy[] {
  const capacityByHallId = new Map(halls.map((hall) => [hall.id, hall.capacity ?? null]));
  return occupancy.map((entry) => ({
    hallId: entry.hallId,
    hallName: entry.hallName,
    count: entry.count,
    capacity: capacityByHallId.get(entry.hallId) ?? null,
  }));
}

/**
 * "Aktif Salon" KPI'ının SAF hesaplayıcısı: kaç FARKLI salonda şu anda
 * en az 1 kişi olduğunu sayar. Backend'in `/attendance/summary`'sindeki
 * `activeHalls` alanı bilerek KULLANILMAZ — o alan kongredeki TOPLAM salon
 * sayısını döner (occupancy'den bağımsız), bu KPI'ın "en az 1 kişi olan
 * salon" etiketiyle anlamsal olarak UYUŞMUYOR. Bunun yerine zaten
 * client'ta birleştirilmiş salon-occupancy listesi üzerinden hesaplanır.
 *
 * Kurallar: 0 kişili salon sayılmaz, negatif/NaN occupancy sayılmaz,
 * capacity null olsa da occupancy>=1 ise sayılır, boş liste -> 0. Aynı
 * `hallId` birden fazla kez gelirse (normal veri sözleşmesinde olmamalı)
 * deterministik davranış için dizideki SON kayıt esas alınır (yinelenen
 * salon iki kez SAYILMAZ).
 */
export function countActiveHalls(
  halls: Pick<MergedHallOccupancy, 'hallId' | 'count'>[],
): number {
  const latestCountByHallId = new Map<string, number>();
  for (const hall of halls) {
    latestCountByHallId.set(hall.hallId, hall.count);
  }

  let active = 0;
  for (const count of latestCountByHallId.values()) {
    if (Number.isFinite(count) && count >= 1) {
      active += 1;
    }
  }
  return active;
}

/**
 * Doluluk hesaplama sonucu. `kind` ayrımı, JSX'in her durumu (kapasitesiz /
 * geçersiz kapasite / gerçek hesap) kendi başına yanlış yorumlamasını
 * engeller — örn. `capacity: null` asla "%0" olarak GÖRÜNMEZ.
 *
 * `rawPercentage`: gerçek matematiksel yüzde, 100'ün üzerine çıkabilir
 * (kapasite aşıldığında gizlenmez).
 * `displayPercentage`: `rawPercentage`'ın tam sayıya yuvarlanmış hâli
 * (metin olarak gösterilecek değer, ör. "%125").
 * `chartPercentage`: yalnızca radial grafiğin GÖRSEL dolumu için 0-100
 * aralığına kırpılmış değer — metin ayrı olduğu için kullanıcı gerçek
 * oranı hâlâ görebilir.
 */
export type OccupancyResult =
  | { kind: 'no-capacity'; count: number }
  | { kind: 'invalid-capacity'; count: number }
  | {
      kind: 'ok';
      count: number;
      capacity: number;
      rawPercentage: number;
      displayPercentage: number;
      chartPercentage: number;
      isOverCapacity: boolean;
      overflowCount: number;
    };

export function calculateOccupancy(count: number, capacity: number | null): OccupancyResult {
  // Negatif/NaN kişi sayısı normal API sözleşmesinde oluşmamalı, ancak
  // savunmacı olarak sessizce "doğruymuş gibi" göstermek yerine 0'a
  // düşürüyoruz (bkz. proje teslim notu — negatif değer asla ekrana çıkmaz).
  const safeCount = Number.isFinite(count) && count > 0 ? count : 0;

  if (capacity == null) {
    return { kind: 'no-capacity', count: safeCount };
  }

  if (!Number.isFinite(capacity) || capacity <= 0) {
    return { kind: 'invalid-capacity', count: safeCount };
  }

  const rawPercentage = (safeCount / capacity) * 100;
  const displayPercentage = Math.round(rawPercentage);
  const chartPercentage = Math.min(displayPercentage, 100);
  const isOverCapacity = safeCount > capacity;
  const overflowCount = isOverCapacity ? safeCount - capacity : 0;

  return {
    kind: 'ok',
    count: safeCount,
    capacity,
    rawPercentage,
    displayPercentage,
    chartPercentage,
    isOverCapacity,
    overflowCount,
  };
}

export type OccupancyStatusKey =
  | 'unknown'
  | 'low'
  | 'medium'
  | 'high'
  | 'near-full'
  | 'full'
  | 'over-capacity';

export type OccupancyStatus = {
  key: OccupancyStatusKey;
  label: string;
  tone: StatusTone;
};

/**
 * Yoğunluk eşikleri (merkezi, tek kaynak — component içine dağıtılmaz):
 * %0-49 düşük · %50-74 orta · %75-89 yüksek · %90-99 doluya yakın ·
 * count===capacity dolu · count>capacity kapasite aşıldı. Renk YALNIZ
 * BAŞINA bilgi taşımaz, her zaman bir Türkçe etiketle birlikte döner.
 *
 * Karar sırası kasıtlı olarak şöyledir (yuvarlanmış `displayPercentage`
 * ÜZERİNDEN DEĞİL):
 * 1. `isOverCapacity` (zaten `count > capacity` ile hesaplı) -> her zaman
 *    "Kapasite aşıldı", yuvarlamadan bağımsız. Örn. capacity=201/count=202
 *    -> rawPercentage≈100.4975 yuvarlanınca 100 olur ama bu asla "Dolu"
 *    ile karıştırılmaz.
 * 2. Tam sayı eşitliği (`count === capacity`) -> "Dolu". Yuvarlanmış
 *    yüzdeye değil, gerçek kişi/kapasite sayısına bakılır.
 * 3. Diğer tüm eşikler gerçek `rawPercentage` üzerinden değerlendirilir;
 *    örn. raw=%99.5 yuvarlanınca 100 görünse bile "Doluya yakın" kalır,
 *    "Dolu" OLMAZ. `displayPercentage` yalnızca ekranda gösterilen METİN
 *    içindir, bu kararın girdisi DEĞİLDİR.
 */
export function getOccupancyStatus(result: OccupancyResult): OccupancyStatus {
  if (result.kind !== 'ok') {
    return { key: 'unknown', label: 'Kapasite tanımlanmadı', tone: 'neutral' };
  }

  if (result.isOverCapacity) {
    return { key: 'over-capacity', label: 'Kapasite aşıldı', tone: 'critical' };
  }
  if (result.count === result.capacity) {
    return { key: 'full', label: 'Dolu', tone: 'critical' };
  }

  const pct = result.rawPercentage;

  if (pct >= 90) {
    return { key: 'near-full', label: 'Doluya yakın', tone: 'critical' };
  }
  if (pct >= 75) {
    return { key: 'high', label: 'Yüksek doluluk', tone: 'warning' };
  }
  if (pct >= 50) {
    return { key: 'medium', label: 'Orta doluluk', tone: 'info' };
  }
  return { key: 'low', label: 'Düşük doluluk', tone: 'positive' };
}

/**
 * Bir ziyaretin (devam eden veya tamamlanmış) dakika cinsinden süresi.
 * Geçersiz tarih -> `NaN` (çağıran taraf `formatDurationMinutes` ile bunu
 * güvenli bir metne çevirir). Negatif fark (saat kayması vb.) -> 0'a
 * kırpılır, asla negatif süre DÖNMEZ.
 */
export function minutesBetween(
  startedAt: string,
  endedAt: string | null,
  nowMs: number,
): number {
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) {
    return NaN;
  }
  const endCandidate = endedAt ? new Date(endedAt).getTime() : nowMs;
  const end = Number.isFinite(endCandidate) ? endCandidate : nowMs;
  const diffMinutes = (end - start) / 60_000;
  return Math.max(0, Math.floor(diffMinutes));
}

/**
 * `minutesBetween` çıktısını Türkçe, okunabilir bir metne çevirir.
 * `<1 dk` iki durumu birlikte kapsar: gerçekten 0 dakika VE geçersiz girdi
 * güvenli biçimde 0'a düşmüş olabilir; her iki durumda da negatif/NaN bir
 * değer asla ekrana çıkmaz.
 */
export function formatDurationMinutes(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return '—';
  }
  if (totalMinutes < 1) {
    return '<1 dk';
  }
  if (totalMinutes < 60) {
    return `${Math.floor(totalMinutes)} dk`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  return minutes > 0 ? `${hours} sa ${minutes} dk` : `${hours} sa`;
}

/**
 * `hall-visits-table.tsx`'teki `formatConfidence` ile aynı sözleşme: v3
 * kararlarında 0-100 arası gerçek yüzde vardır, v2'de yalnızca etiket.
 */
export function formatConfidence(
  confidenceLevel: string | null,
  confidenceScore: number | null,
): string {
  if (confidenceScore === null) {
    return confidenceLevel ?? '—';
  }
  return `%${Math.round(confidenceScore)}${confidenceLevel ? ` · ${confidenceLevel}` : ''}`;
}

/**
 * `/attendance/hall-visits`'in kongre-geneli (hallId filtresiz) canlı takip
 * özeti için tek seferde çekilen sayfa boyutu. Backend'in KENDİSİ bu sayıyı
 * DAYATMIYOR (varsayılan `pageSize` backend'de 20, `page`/`pageSize`/`total`
 * zaten tam destekleniyor) — bu tamamen frontend'in tercih ettiği bir bütçe.
 * Aynı sabit hem genel özet isteğinde hem de bir salon kartı "Daha fazla
 * göster" ile kendi `hallId`'sine özel sonraki sayfaları çekerken kullanılır,
 * böylece uygulama genelinde tutarlı tek bir sayfa boyutu olur.
 */
export const DEFAULT_ROSTER_PAGE_SIZE = 100;

/**
 * Bir salonun katılımcı listesinde henüz yüklenmemiş kişi olup olmadığını
 * hesaplar. `total`, her zaman `/attendance/summary`'nin doğru `count`
 * değeridir (yüklenen/kırpılmış dizi uzunluğu DEĞİL) — bu fonksiyon o gerçek
 * toplamla yüklenen satır sayısını karşılaştırır. Geçersiz/negatif girdiler
 * güvenli biçimde 0'a düşürülür, asla yanlışlıkla "daha fazla var" demez.
 */
export function hasMoreRoster(loadedCount: number, total: number): boolean {
  const safeLoaded = Number.isFinite(loadedCount) && loadedCount > 0 ? loadedCount : 0;
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  return safeLoaded < safeTotal;
}

/**
 * Kullanıcıya "kaçının yüklendiği" konusunda dürüst bir metin verir — ör.
 * "100 / 995 kişi gösteriliyor". `hall-occupancy-card.tsx`'teki genişletme
 * düğmesinin etiketi ASLA bu fonksiyonun `total` girdisinden farklı bir
 * sayı (ör. yüklenen dizi uzunluğu) göstermemelidir.
 */
export function describeRosterCoverage(loadedCount: number, total: number): string {
  const safeLoaded = Number.isFinite(loadedCount) && loadedCount > 0 ? loadedCount : 0;
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  return `${safeLoaded} / ${safeTotal} kişi gösteriliyor`;
}

/**
 * İki katılımcı sayfasını `id` üzerinden yinelenenleri ELEYEREK birleştirir.
 * Sıra korunur: önce `existing`, sonra `incoming`'in henüz görülmemiş
 * öğeleri. Sayfalar backend'de `startedAt DESC` ile sıralandığından normal
 * koşullarda çakışma OLMAZ, ancak sayfalar arasında bir ziyaretin durumu
 * değişirse (ör. yeni bir ziyaret başlarsa) aynı kişinin iki kez
 * listelenmesini engellemek için savunmacı olarak dedup uygulanır.
 */
export function mergeRosterPage<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  for (const item of incoming) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}
