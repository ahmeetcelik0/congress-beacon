'use client';

import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/ui/status-badge';

/**
 * Canlı takip panelinin GERÇEK yenileme sağlığı — sayfa üstündeki
 * `LiveBadge` yalnızca "bu sayfa otomatik yenilenir" bilgisini dekoratif
 * olarak verir; bu bileşen ise `LiveDashboard`'un polling state'ini
 * doğrudan yansıtır: en son BAŞARILI güncelleme ne zaman oldu, ve
 * polling aralığına göre makul bir eşiği (`staleAfterMs`) aştıysa
 * "veri gecikiyor" uyarısı.
 *
 * Kendi zamanlayıcısını kurar (yalnızca ekranda "X sn önce" metnini
 * güncellemek için — YENİ bir API isteği ÜRETMEZ).
 */
export function LiveStatusIndicator({
  lastUpdatedAt,
  staleAfterMs,
  hasError,
}: {
  lastUpdatedAt: Date | null;
  staleAfterMs: number;
  hasError: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const bootstrap = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearTimeout(bootstrap);
      clearInterval(interval);
    };
  }, []);

  if (!lastUpdatedAt || now === null) {
    return (
      <span className="tp-live-status" aria-live="polite">
        Yükleniyor…
      </span>
    );
  }

  const elapsedMs = now - lastUpdatedAt.getTime();
  const isStale = elapsedMs > staleAfterMs;
  const elapsedSec = Math.max(0, Math.round(elapsedMs / 1000));
  const relative = elapsedSec < 5 ? 'az önce' : elapsedSec < 60 ? `${elapsedSec} sn önce` : `${Math.floor(elapsedSec / 60)} dk önce`;

  return (
    <span className="tp-live-status" aria-live="polite">
      Son başarılı güncelleme: {relative}
      {isStale && (
        <StatusBadge tone="warning" className="tp-live-status-badge">
          Veri gecikiyor
        </StatusBadge>
      )}
      {!isStale && hasError && (
        <StatusBadge tone="warning" className="tp-live-status-badge">
          Son yenileme başarısız, önceki veri gösteriliyor
        </StatusBadge>
      )}
    </span>
  );
}
