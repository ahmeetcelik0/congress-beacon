'use client';

import { useEffect, useState } from 'react';
import type { HallVisitSummary } from '@/lib/api';
import { formatConfidence, formatDurationMinutes, minutesBetween } from '@/lib/hall-occupancy';

/**
 * Bir salonun "şu an içeride" katılımcı listesi. Kart genişletildiğinde
 * gösterilir. Kendi API isteği YAPMAZ — veri, üst seviyede zaten tek
 * seferde çekilen roster'dan (`listHallVisits({isOpen:true})`) props ile
 * gelir (N+1 önleme).
 *
 * Süre göstergeleri için TEK merkezi zamanlayıcı kullanılır (satır başına
 * ayrı `setInterval` YOK) — `now` üst bileşenden gelir.
 */
export function HallParticipantList({
  visits,
  totalCount,
  now,
}: {
  visits: HallVisitSummary[];
  // Salonun GERÇEK anlık kişi sayısı (`/attendance/summary`'den). `visits`
  // bundan DAHA AZ öğe içerebilir (kongre geneli roster bütçesi salonlar
  // arasında paylaşıldığı için, bkz. `hall-occupancy-card.tsx`) — bu yüzden
  // "boş liste" ile "gerçekten kimse yok" burada AYRIŞTIRILIR: `totalCount`
  // sıfırsa gerçekten kimse yok; sıfırdan büyükse ama `visits` boşsa, bu
  // yalnızca bu görünüme henüz hiç satır YÜKLENMEDİĞİ anlamına gelir — o
  // durumda yanlış "kimse yok" mesajı YERİNE hiçbir şey göstermeyiz, üst
  // bileşendeki kapsam bandı ("0 / N kişi gösteriliyor" + "Daha fazla
  // göster") zaten durumu açıklar.
  totalCount: number;
  now: number | null;
}) {
  const sorted = [...visits].sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  if (sorted.length === 0) {
    if (totalCount > 0) {
      return null;
    }
    return <p className="tp-participant-empty">Şu an bu salonda kimse yok.</p>;
  }

  return (
    <ul className="tp-participant-list">
      {sorted.map((visit) => {
        const name = `${visit.userFirstName} ${visit.userLastName}`.trim() || 'İsimsiz katılımcı';
        const minutes = now === null ? NaN : minutesBetween(visit.startedAt, null, now);

        return (
          <li key={visit.id} className="tp-participant-row">
            <div className="tp-participant-main">
              <span className="tp-participant-name" title={name}>
                {name}
              </span>
              <span className="tp-participant-confidence">
                {formatConfidence(visit.confidenceLevel, visit.confidenceScore)}
              </span>
            </div>
            <span className="tp-participant-duration">
              {now === null ? '…' : formatDurationMinutes(minutes)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * `now` üretimi için tek merkezi hook — birden fazla `HallOccupancyCard`
 * kendi ayrı zamanlayıcısını kurmasın diye `HallOccupancyGrid` bunu bir kez
 * çağırıp `now`'u tüm kartlara props ile dağıtır.
 */
export function useSharedNow(intervalMs: number): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Sunucu/istemci hydration uyumsuzluğu olmasın diye ilk gerçek değer
    // de bir zamanlayıcı callback'inden gelsin (bkz. freshness.tsx / hall-roster.tsx
    // ile aynı desen).
    const bootstrap = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(bootstrap);
      clearInterval(interval);
    };
  }, [intervalMs]);

  return now;
}
