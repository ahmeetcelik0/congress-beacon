import type { StatusTone } from '@/components/ui/status-badge';

export type CongressStatusKey = 'active' | 'upcoming' | 'past' | 'unknown';

export type CongressStatusInfo = {
  key: CongressStatusKey;
  label: string;
  tone: StatusTone;
};

type CongressDateFields = {
  startDate: string | null;
  endDate: string | null;
};

/**
 * Kongrenin tarihe göre durumu tamamen frontend'de hesaplanır (backend'de
 * ayrı bir "status" alanı yok, `startDate`/`endDate` nullable string).
 *
 * Zaman dilimi tutarlılığı: hem depolanan tarihler hem de "bugün" TEK bir
 * referans çerçevesinde (UTC takvim günü) karşılaştırılır. `startDate`/
 * `endDate` `<input type="date">` ile gönderildiği için backend bunları UTC
 * gece yarısı olarak saklar (`new Date('2026-07-23')`); ISO string'in ilk 10
 * karakteri (`YYYY-MM-DD`) bu yüzden her zaman kullanıcının seçtiği takvim
 * günüyle birebir eşleşir. "Bugün"ü de aynı çerçevede (UTC) hesaplayarak
 * yerel saat dilimi ile karışmasını (ör. gece yarısına yakın saatlerde günün
 * kayması) önlüyoruz. Bilinen küçük ödün: TR (UTC+3) öğleden sonra/gece
 * saatlerinde durum geçişi tam yerel gece yarısında değil, UTC gece
 * yarısında (TR saatiyle 03:00) gerçekleşir — çoklu günlük bir kongre
 * etkinliği için bu sapma anlamlı bir yanıltma yaratmaz.
 */
function dateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDateOnly(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

export function getCongressStatus(
  congress: CongressDateFields,
  now: Date = new Date(),
): CongressStatusInfo {
  const start = toDateOnly(congress.startDate);
  const end = toDateOnly(congress.endDate);

  if (!start && !end) {
    return { key: 'unknown', label: 'Tarih belirtilmemiş', tone: 'neutral' };
  }

  const today = dateOnlyUtc(now);

  if (start && today < start) {
    return { key: 'upcoming', label: 'Yaklaşan', tone: 'info' };
  }
  if (end && today > end) {
    return { key: 'past', label: 'Tamamlandı', tone: 'neutral' };
  }
  return { key: 'active', label: 'Aktif', tone: 'positive' };
}

const STATUS_ORDER: Record<CongressStatusKey, number> = {
  active: 0,
  upcoming: 1,
  past: 2,
  unknown: 3,
};

function timeOrLast(iso: string | null): number {
  return iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY;
}

function timeOrFirst(iso: string | null): number {
  return iso ? new Date(iso).getTime() : Number.NEGATIVE_INFINITY;
}

/**
 * Sıralama: önce durum grubu (Aktif → Yaklaşan → Geçmiş → Bilinmiyor), aynı
 * grup içinde:
 * - Aktif/Yaklaşan/Bilinmiyor: yakın başlangıç tarihi önce (tarih yoksa
 *   oluşturulma tarihine göre, o da yoksa listenin sonuna düşer).
 * - Geçmiş: en son biten kongre önce (yakın zamanda bitenler üstte).
 */
export function sortCongressesByStatus<T extends CongressDateFields & { createdAt: string }>(
  congresses: T[],
  now: Date = new Date(),
): T[] {
  return [...congresses].sort((a, b) => {
    const statusA = getCongressStatus(a, now).key;
    const statusB = getCongressStatus(b, now).key;

    if (statusA !== statusB) {
      return STATUS_ORDER[statusA] - STATUS_ORDER[statusB];
    }

    if (statusA === 'past') {
      return timeOrFirst(b.endDate) - timeOrFirst(a.endDate);
    }

    if (statusA === 'unknown') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }

    return timeOrLast(a.startDate ?? a.createdAt) - timeOrLast(b.startDate ?? b.createdAt);
  });
}
