'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ErrorState } from './error-state';

/**
 * `congresses/halls/beacons/attendance/tracking-health/sessions/reports`
 * route segmentlerindeki `error.tsx` dosyalarinin ortak yedek arayuzu.
 *
 * `loadCongresses()` zaten "kongre listesi alinamadi" beklenen durumunu
 * yakalayip erken donuyor (bkz. `CongressLoadError`) - bu bilesen yalnizca
 * BEKLENMEYEN render hatalarini yakalayan SON CARE katmanidir (ör. kongre
 * secildikten sonra ayni sayfadaki diger API cagrilarinin -salon listesi,
 * katilim ozeti, takip sagligi vb.- backend tamamen coktugu bir anda
 * patlamasi). Next.js `error.tsx` yalnizca kendi route segmentini (page +
 * nested layout) sarar, kok layout'u (sidebar) SARMAZ - bu yuzden bu hata
 * gorununse bile sidebar/navigasyon kullanilabilir kalir.
 *
 * Ham hata mesaji/stack trace hicbir zaman ekrana basilmaz; yalnizca
 * konsola (digest ile birlikte, sunucu loglariyla eslestirme icin) loglanir.
 */
export function RouteErrorFallback({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('[route-error]', error);
  }, [error]);

  return (
    <main className="panel-page">
      <ErrorState
        title="Bu sayfa yüklenirken bir sorun oluştu."
        description="Sunucuya şu anda ulaşılamıyor olabilir. Birkaç saniye sonra tekrar deneyin."
        action={
          <div className="ui-error-state-action-row">
            <button type="button" onClick={retry}>
              Yeniden dene
            </button>
            <Link href="/congresses">Kongreler sayfasına git</Link>
          </div>
        }
      />
    </main>
  );
}
