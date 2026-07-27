'use client';

import { useEffect, useState } from 'react';
import {
  api,
  type AttendanceSummary,
  type Hall,
  type HallVisitSummary,
  type OccupancySeries,
} from '@/lib/api';
import { DEFAULT_ROSTER_PAGE_SIZE, mergeHallOccupancyWithCapacity } from '@/lib/hall-occupancy';
import { KpiRow } from './kpi-row';
import { HallOccupancyGrid } from './hall-occupancy-grid';
import { OccupancyChart } from './occupancy-chart';
import { DurationStatsGrid } from './duration-stats-grid';
import { LiveStatusIndicator } from './live-status-indicator';

const REFRESH_INTERVAL_MS = 5_000;
// "Veri gecikiyor" eşiği polling aralığının katı olarak tanımlanır (rastgele
// bir sayı değil) — 3 ardışık başarısız tur boyunca yeni veri gelmediyse
// gerçekten bir sorun olduğunu varsayıyoruz.
const STALE_AFTER_MS = REFRESH_INTERVAL_MS * 3;
// Bu, KONGRE GENELİNDE (hallId filtresiz) "şu an içeride" özet listesi için
// bir bütçedir — salon başına bir sınır DEĞİLDİR. Bir salonun gerçek kişi
// sayısı her zaman `summary.hallOccupancy`'den (bkz. `KpiRow`/kart üzerindeki
// "N kişi") gelir ve bu bütçeden ETKİLENMEZ. Bir salonun açık ziyaret sayısı
// bu bütçeyi (kongredeki TÜM salonlar arasında paylaşılan) aşarsa, o salonun
// kartındaki katılımcı listesi eksik gösterilir; kullanıcı kartı açtığında
// `HallOccupancyCard` kendi `hallId`'sine özel "Daha fazla göster" isteğiyle
// eksik sayfaları tamamlayabilir (bkz. hall-occupancy-card.tsx).
const ROSTER_PAGE_SIZE = DEFAULT_ROSTER_PAGE_SIZE;

/**
 * `Hall.capacity` yalnızca ilk yüklemede (server-side, `page.tsx`'te)
 * çekilir ve polling'e DAHIL EDİLMEZ: fiziksel kapasite saniyeler
 * içinde değişen bir veri değildir, her 5 sn'de bir tekrar çekmek
 * gereksiz yük olur. Bilinen sınırlama: bir salonun kapasitesi
 * Salonlar sayfasından değiştirilirse, bu sekmenin bunu görmesi için
 * sayfa yenilenmesi gerekir.
 */
export function LiveDashboard({
  congressId,
  initialSummary,
  initialSeries,
  initialRoster,
  initialHalls,
}: {
  congressId: string;
  initialSummary: AttendanceSummary;
  initialSeries: OccupancySeries;
  initialRoster: HallVisitSummary[];
  initialHalls: Hall[];
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [series, setSeries] = useState(initialSeries);
  const [roster, setRoster] = useState(initialRoster);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(() => new Date());
  // Başarılı-sonra-polling-hatası: önceki veri KORUNUR, yalnızca bu bayrak
  // bir uyarı şeridi gösterir. Bir sonraki başarılı turda temizlenir.
  const [pollError, setPollError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    // İstek TAMAMLANMADAN bir sonrakini BAŞLATMAYAN sıralı yapı: sabit
    // `setInterval` yerine, her turun kendi sonunda bir sonrakini planladığı
    // recursive `setTimeout` kullanılır. Böylece istek süresi 5 sn'yi aşsa
    // bile aynı grup için asla iki fetch üst üste binmez (overlap yapısal
    // olarak imkansızdır). `requestSeq`, ek/ucuz bir güvence katmanıdır:
    // yalnızca EN SON başlatılan turun sonucu state'e yazılır — ör. React
    // Strict Mode'un geliştirmede efekt'i iki kez çalıştırıp hemen
    // temizlemesi gibi kenar durumlarda geç dönen bir yanıtın state'i
    // ezmesini engeller.
    let requestSeq = 0;

    const scheduleNext = () => {
      if (cancelled) return;
      timeoutId = setTimeout(runPoll, REFRESH_INTERVAL_MS);
    };

    const runPoll = () => {
      if (cancelled) return;
      const seq = ++requestSeq;

      Promise.all([
        api.getAttendanceSummary(congressId),
        api.getOccupancySeries({ congressId, bucketMinutes: 15 }),
        api.listHallVisits({ congressId, isOpen: true, pageSize: ROSTER_PAGE_SIZE }),
      ])
        .then(([nextSummary, nextSeries, nextRoster]) => {
          if (cancelled || seq !== requestSeq) return;
          setSummary(nextSummary);
          setSeries(nextSeries);
          setRoster(nextRoster.items);
          setLastUpdatedAt(new Date());
          setPollError(false);
        })
        .catch(() => {
          if (cancelled || seq !== requestSeq) return;
          // Önceki başarılı veri KORUNUR, yalnızca uyarı bayrağı açılır;
          // bir sonraki başarılı turda otomatik temizlenir.
          setPollError(true);
        })
        .finally(() => {
          scheduleNext();
        });
    };

    timeoutId = setTimeout(runPoll, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [congressId]);

  const mergedHalls = mergeHallOccupancyWithCapacity(summary.hallOccupancy, initialHalls);

  return (
    <>
      <div className="tp-live-status-row">
        <LiveStatusIndicator
          lastUpdatedAt={lastUpdatedAt}
          staleAfterMs={STALE_AFTER_MS}
          hasError={pollError}
        />
      </div>

      <KpiRow
        currentlyInsideTotal={summary.currentlyInsideTotal}
        participantsSeenToday={summary.participantsSeenToday}
        lastObservationAt={summary.lastObservationAt}
        halls={mergedHalls}
      />

      <section className="tp-section">
        <div className="tp-section-title">
          <h2>Salon Canlı Takibi</h2>
          <span>canlı · {REFRESH_INTERVAL_MS / 1000} sn&apos;de bir güncellenir</span>
        </div>
        <HallOccupancyGrid congressId={congressId} halls={mergedHalls} roster={roster} />
      </section>

      <section className="tp-section">
        <div className="tp-section-title">
          <h2>Kalış Süresi</h2>
          <span>tamamlanmış ziyaretler</span>
        </div>
        <DurationStatsGrid stats={summary.durationStats} />
      </section>

      <section className="tp-section">
        <div className="tp-section-title">
          <h2>Yoğunluk (Bugün)</h2>
          <span>15 dk aralıklarla</span>
        </div>
        <OccupancyChart series={series} />
      </section>
    </>
  );
}
